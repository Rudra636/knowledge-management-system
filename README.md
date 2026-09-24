# Stacks — Knowledge Management System

A full-stack knowledge management system for storing files of any type, automatically
extracting and indexing their content, and asking an AI chatbot questions about them.

- **Frontend:** Plain HTML, CSS, JavaScript (no framework, no build step)
- **Backend:** Node.js + Express
- **Database:** MySQL
- **Chatbot:** Gemini studio API , grounded in each file's extracted text

## Features

- Upload any file type (PDF, Word, Excel, CSV, text/markdown/code files, images, etc.)
- Automatic text extraction for PDF, DOCX, XLSX/XLS, and plain-text formats
- Auto-generated summary + key points per file (via Claude), shown in the file's Overview tab
- Full-text search across file names, extracted content, and summaries
- Organize files into "shelves" (categories) and tags
- Chatbot for **one file at a time** ("what are the key terms in this contract?")
- **General chatbot** across your most recent files ("what did I save about pricing?")
- Chat history is stored and reloaded per file / per general session

## Project structure

```
knowledge-management-system/
├── server.js                 # Express app entry point
├── config/db.js              # MySQL connection pool
├── db/schema.sql             # Database schema
├── db/init-db.js             # Script to create the DB + tables
├── middleware/upload.js      # Multer file upload config
├── utils/textExtractor.js    # PDF/DOCX/XLSX/text extraction
├── utils/claudeService.js    # Claude API calls (summaries + chat)
├── routes/files.js           # File CRUD + search endpoints
├── routes/chat.js            # Chatbot endpoints
├── public/                   # Frontend (HTML/CSS/JS)
│   ├── index.html
│   ├── css/style.css
│   └── js/{app.js, chatbot.js}
├── uploads/                  # Uploaded files are stored here
├── .env.example
└── package.json
```

## 1. Prerequisites

- Node.js 18+
- A running MySQL server (local or remote)
- An Anthropic API key from https://console.anthropic.com (for summaries + chat)

## 2. Install dependencies

```bash
cd knowledge-management-system
npm install
```

## 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=knowledge_management

ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-5
```

> The app still works without an API key — uploads, search, and text extraction all
> function normally. Only the AI summary/key-points generation and the chatbot require the key.

## 4. Create the database

This runs `db/schema.sql` against your MySQL server to create the database and tables:

```bash
npm run init-db
```

(Alternatively, run `db/schema.sql` yourself in MySQL Workbench / the `mysql` CLI.)

## 5. Run the app

```bash
npm start
```

Then open **http://localhost:5000** in your browser.

For development with auto-restart on file changes:

```bash
npm run dev
```

## How it works

1. **Upload** — a file is saved to `/uploads`, and a row is created in the `files` table.
2. **Extraction** — `utils/textExtractor.js` pulls text out of PDFs (`pdf-parse`), Word docs
   (`mammoth`), spreadsheets (`xlsx`), and plain-text files. Images and other binary formats
   are stored but not text-indexed (see "Extending" below).
3. **AI analysis** — if extraction succeeds and an API key is set, `utils/claudeService.js`
   asks Claude for a short summary and a list of key points, stored as JSON.
4. **Chat** — `routes/chat.js` sends the file's extracted text (or several files' summaries,
   in general mode) to Claude as context, along with your question and recent chat history,
   and stores the exchange in `chat_messages`.

## Extending

- **OCR for images / scanned PDFs:** add `tesseract.js` and call it from `textExtractor.js`
  for image mime types.
- **Legacy `.doc` / `.ppt`:** these need a converter (e.g. LibreOffice headless) since
  `mammoth` only handles `.docx`.
- **Vector search / RAG:** for large archives, replace the "last 8 files" general-chat
  context with embeddings + a vector index (e.g. store embeddings in MySQL or use a
  dedicated vector DB) so the chatbot can search relevant chunks instead of recent files.
- **Swap in OpenAI instead of Claude:** replace the client in `utils/claudeService.js` with
  the OpenAI SDK — the rest of the app (routes, DB schema, frontend) doesn't need to change.
