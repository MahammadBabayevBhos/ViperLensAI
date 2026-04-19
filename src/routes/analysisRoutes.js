const express = require('express');
const analysisController = require('../controllers/analysisController');
const upload = require('../middleware/uploadMiddleware');
const { requireAuth, requirePremium } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, analysisController.renderHome);
router.get('/status/:pipelineId', requireAuth, analysisController.getPipelineStatusById);
router.post('/analyze', requireAuth, upload.single('malwareSample'), analysisController.handleUploadAndAnalyze);
router.post(
  '/premium/ai',
  requireAuth,
  requirePremium,
  upload.none(),
  analysisController.handleDeepAiAnalysis
);
router.post('/premium/report', requireAuth, requirePremium, analysisController.handlePdfDownload);

module.exports = router;
