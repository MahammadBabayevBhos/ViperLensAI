const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const FALCON_REPORTS_DIR = path.join(REPORTS_DIR, 'falcon');

module.exports = {
  ROOT_DIR,
  UPLOADS_DIR,
  REPORTS_DIR,
  FALCON_REPORTS_DIR
};
