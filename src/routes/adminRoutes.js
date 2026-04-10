const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/admin/users/:userId/toggle-tier', requireAuth, adminController.toggleUserTier);

module.exports = router;
