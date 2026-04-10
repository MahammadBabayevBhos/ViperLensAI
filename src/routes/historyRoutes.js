const express = require('express');
const historyController = require('../controllers/historyController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/history', requireAuth, historyController.renderHistory);
router.get('/history/:id', requireAuth, historyController.viewHistoryReport);
router.post('/history/:id/delete', requireAuth, historyController.deleteHistoryRecord);

module.exports = router;
