const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.log', '.js', '.py', '.html', '.css'];
const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls'];

/**
 * Extracts plain text from a file on disk based on its extension.
 * Returns { text, status } where status is one of:
 * 'done' | 'unsupported' | 'failed'
 */
async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  try {
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return { text: data.text.trim(), status: data.text.trim() ? 'done' : 'unsupported' };
    }

    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return { text: result.value.trim(), status: result.value.trim() ? 'done' : 'unsupported' };
    }

    if (SPREADSHEET_EXTENSIONS.includes(ext)) {
      const workbook = XLSX.readFile(filePath);
      let combined = '';
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        combined += `\n--- Sheet: ${sheetName} ---\n${csv}`;
      });
      return { text: combined.trim(), status: combined.trim() ? 'done' : 'unsupported' };
    }

    if (TEXT_EXTENSIONS.includes(ext)) {
      const text = fs.readFileSync(filePath, 'utf8');
      return { text: text.trim(), status: 'done' };
    }

    // Images, audio, video, archives, .doc, .ppt, etc. — no text extraction yet.
    return { text: '', status: 'unsupported' };
  } catch (err) {
    console.error(`Text extraction failed for ${originalName}:`, err.message);
    return { text: '', status: 'failed' };
  }
}

module.exports = { extractText };
