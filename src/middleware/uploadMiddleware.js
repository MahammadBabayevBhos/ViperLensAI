const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { UPLOADS_DIR } = require('../config/paths');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const baseName = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9-_]/g, '_');

    const timestamp = Date.now();
    cb(null, `${timestamp}-${baseName}.exe`);
  }
});

const fileFilter = (_req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (extension !== '.exe') {
    return cb(new Error('Only .exe files are accepted.'));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

module.exports = upload;
