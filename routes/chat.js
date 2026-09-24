const express = require('express');
const router = express.Router();

const pool = require('../config/db');
const { askChatbot, isConfigured, PROVIDER } = require('../utils/aiService');

// POST /api/chat — ask a question about one file (fileId) or across all files (no fileId)
// Body: { fileId?: number, question: string }
router.post('/', async (req, res) => {
  const { fileId, question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
  if (!isConfigured()) {
    const keyName = PROVIDER === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY';
    return res.status(400).json({ error: `${keyName} is not configured on the server (AI_PROVIDER=${PROVIDER})` });
  }

  try {
    let fileContext;

    if (fileId) {
      const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [fileId]);
      if (!rows.length) return res.status(404).json({ error: 'File not found' });
      if (!rows[0].extracted_text) {
        return res.status(400).json({ error: 'This file has no readable text content to chat about' });
      }
      fileContext = rows[0];
    } else {
      // General mode: search across all files with extracted text for relevant context.
      const [rows] = await pool.query(
        'SELECT id, original_name, summary, extracted_text FROM files WHERE extracted_text IS NOT NULL ORDER BY uploaded_at DESC LIMIT 8'
      );
      if (!rows.length) {
        return res.status(400).json({ error: 'No files with readable content are available yet' });
      }
      fileContext = rows;
    }

    // Pull recent conversation history for context (scoped to this file, or general if fileId is null).
    const [historyRows] = await pool.query(
      'SELECT role, message FROM chat_messages WHERE file_id <=> ? ORDER BY created_at DESC LIMIT 10',
      [fileId || null]
    );
    const history = historyRows.reverse();

    const answer = await askChatbot({ question, fileContext, history });

    await pool.query('INSERT INTO chat_messages (file_id, role, message) VALUES (?, ?, ?)', [fileId || null, 'user', question]);
    await pool.query('INSERT INTO chat_messages (file_id, role, message) VALUES (?, ?, ?)', [fileId || null, 'assistant', answer]);

    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chatbot request failed', details: err.message });
  }
});

// GET /api/chat/history?fileId= — retrieve chat history (general if fileId omitted)
router.get('/history', async (req, res) => {
  try {
    const { fileId } = req.query;
    const [rows] = await pool.query(
      'SELECT role, message, created_at FROM chat_messages WHERE file_id <=> ? ORDER BY created_at ASC',
      [fileId || null]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history', details: err.message });
  }
});

module.exports = router;
