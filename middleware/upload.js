const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${safeBase}-${uniqueSuffix}${ext}`);
  }
});

// Accept all file types — this is a general-purpose KMS.
const maxSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10);

const upload = multer({
  storage,
  limits: { fileSize: maxSizeMb * 1024 * 1024 }
});

module.exports = upload;
