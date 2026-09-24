require('dotenv').config();

const PROVIDER = (process.env.AI_PROVIDER || 'claude').toLowerCase();

// Claude has a large context limit but we still trim very long documents
// to keep requests fast and cheap on either provider.
const MAX_CHARS = 60000;
function trim(text) {
  if (!text) return '';
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '\n\n[...content truncated...]' : text;
}

function buildSummaryPrompt(text, fileName) {
  return `You are analyzing a document called "${fileName}" for a knowledge management system.
Read the content below and respond ONLY with valid JSON (no markdown fences, no preamble) in this exact shape:
{"summary": "a concise 2-4 sentence summary", "keyPoints": ["key point 1", "key point 2", "..."]}
Include 4-8 key points, each a short standalone sentence.

DOCUMENT CONTENT:
"""
${trim(text)}
"""`;
}

function buildContextBlock(fileContext) {
  if (Array.isArray(fileContext)) {
    return fileContext
      .map(
        (f, i) =>
          `File ${i + 1}: "${f.original_name}"\nSummary: ${f.summary || 'N/A'}\nContent excerpt: ${trim(
            f.extracted_text || ''
          ).slice(0, 4000)}`
      )
      .join('\n\n---\n\n');
  }
  return `File: "${fileContext.original_name}"\n\nFull content:\n"""\n${trim(fileContext.extracted_text || '')}\n"""`;
}

function parseJsonResponse(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []
    };
  } catch (err) {
    console.error('Failed to parse AI JSON response:', err.message);
    return { summary: raw.slice(0, 500), keyPoints: [] };
  }
}

/* ---------------------------- Claude backend ---------------------------- */

let anthropicClient;
function getAnthropicClient() {
  if (!anthropicClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

async function claudeSummary(text, fileName) {
  const response = await getAnthropicClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    messages: [{ role: 'user', content: buildSummaryPrompt(text, fileName) }]
  });
  const raw = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('\n');
  return parseJsonResponse(raw);
}

async function claudeChat({ question, fileContext, history }) {
  const systemPrompt = `You are a helpful knowledge management assistant. Answer the user's question using ONLY the document content provided below. If the answer isn't in the content, say so clearly. Be concise and cite the file name when relevant.

${buildContextBlock(fileContext)}`;

  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.message })),
    { role: 'user', content: question }
  ];

  const response = await getAnthropicClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    system: systemPrompt,
    messages
  });
  return response.content.map((b) => (b.type === 'text' ? b.text : '')).join('\n');
}

/* ---------------------------- Gemini backend ----------------------------
   Free tier via Google AI Studio: https://aistudio.google.com/apikey
   Uses the @google/genai SDK. Model defaults to the "gemini-flash-latest"
   alias so it keeps working as Google rotates model versions.
--------------------------------------------------------------------------- */

let geminiClientPromise;
function getGeminiClient() {
  if (!geminiClientPromise) {
    // @google/genai ships as an ES Module, so it must be loaded with a
    // dynamic import() rather than require() from this CommonJS file.
    geminiClientPromise = import('@google/genai').then(
      ({ GoogleGenAI }) => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    );
  }
  return geminiClientPromise;
}
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

async function geminiSummary(text, fileName) {
  const client = await getGeminiClient();
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildSummaryPrompt(text, fileName)
  });
  return parseJsonResponse(response.text || '');
}

async function geminiChat({ question, fileContext, history }) {
  const systemInstruction = `You are a helpful knowledge management assistant. Answer the user's question using ONLY the document content provided below. If the answer isn't in the content, say so clearly. Be concise and cite the file name when relevant.

${buildContextBlock(fileContext)}`;

  // Gemini's generateContent takes a flat conversation as "contents",
  // with each turn tagged "user" or "model" (its name for the assistant role).
  const contents = [
    ...history.map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.message }] })),
    { role: 'user', parts: [{ text: question }] }
  ];

  const client = await getGeminiClient();
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: { systemInstruction }
  });
  return response.text || '';
}

/* ------------------------------- Public API ------------------------------ */

async function generateSummaryAndKeyPoints(text, fileName) {
  return PROVIDER === 'gemini' ? geminiSummary(text, fileName) : claudeSummary(text, fileName);
}

async function askChatbot({ question, fileContext, history = [] }) {
  return PROVIDER === 'gemini'
    ? geminiChat({ question, fileContext, history })
    : claudeChat({ question, fileContext, history });
}

function isConfigured() {
  return PROVIDER === 'gemini' ? Boolean(process.env.GEMINI_API_KEY) : Boolean(process.env.ANTHROPIC_API_KEY);
}

module.exports = { generateSummaryAndKeyPoints, askChatbot, isConfigured, PROVIDER };