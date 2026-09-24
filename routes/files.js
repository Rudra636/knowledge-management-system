const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const pool = require('../config/db');
const upload = require('../middleware/upload');
const { extractText } = require('../utils/textExtractor');
const { generateSummaryAndKeyPoints, isConfigured } = require('../utils/aiService');

// POST /api/files/upload — upload one file, extract text, generate summary + key points
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { originalname, filename, path: filePath, mimetype, size } = req.file;
  const ext = path.extname(originalname).toLowerCase().replace('.', '') || 'unknown';
  const category = req.body.category || 'Uncategorized';
  const tags = req.body.tags || '';

  try {
    const [result] = await pool.query(
      `INSERT INTO files (original_name, stored_name, file_path, file_type, mime_type, file_size, category, tags, extraction_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing')`,
      [originalname, filename, filePath, ext, mimetype, size, category, tags]
    );
    const fileId = result.insertId;

    // Extract text, then (if we have content and an API key) generate summary + key points.
    const { text, status } = await extractText(filePath, originalname);

    let summary = null;
    let keyPoints = null;

    if (status === 'done' && text && isConfigured()) {
      try {
        const ai = await generateSummaryAndKeyPoints(text, originalname);
        summary = ai.summary;
        keyPoints = JSON.stringify(ai.keyPoints);
      } catch (err) {
        console.error('AI summary generation failed:', err.message);
      }
    }

    await pool.query(
      `UPDATE files SET extracted_text = ?, extraction_status = ?, summary = ?, key_points = ? WHERE id = ?`,
      [text || null, status, summary, keyPoints, fileId]
    );

    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [fileId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// GET /api/files — list all files (optionally filter by category or search text)
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = 'SELECT id, original_name, file_type, mime_type, file_size, category, tags, summary, extraction_status, uploaded_at FROM files WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (original_name LIKE ? OR extracted_text LIKE ? OR summary LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY uploaded_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch files', details: err.message });
  }
});

// GET /api/files/:id — full detail for one file, including extracted text and key points
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'File not found' });
    const file = rows[0];
    if (file.key_points && typeof file.key_points === 'string') {
      try { file.key_points = JSON.parse(file.key_points); } catch (_) { /* leave as-is */ }
    }
    res.json(file);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch file', details: err.message });
  }
});

// GET /api/files/:id/download — download the original file
router.get('/:id/download', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'File not found' });
    res.download(rows[0].file_path, rows[0].original_name);
  } catch (err) {
    res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

// DELETE /api/files/:id — remove file record + file from disk
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'File not found' });

    if (fs.existsSync(rows[0].file_path)) fs.unlinkSync(rows[0].file_path);
    await pool.query('DELETE FROM files WHERE id = ?', [req.params.id]);
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
});

module.exports = router;
