require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const filesRouter = require('./routes/files');
const chatRouter = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/files', filesRouter);
app.use('/api/chat', chatRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Fallback to the SPA shell for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Knowledge Management System running at http://localhost:${PORT}`);
});
