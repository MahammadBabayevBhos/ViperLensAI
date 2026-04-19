const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin, requireAdminPage } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/admin/dashboard', requireAuth, requireAdminPage, adminController.renderDashboard);
router.post('/admin/users/:userId/toggle-tier', requireAuth, requireAdmin, adminController.toggleUserTier);
router.post('/admin/users/:userId/role', requireAuth, requireAdmin, adminController.updateUserRole);
router.post('/admin/users/:userId/delete', requireAuth, requireAdmin, adminController.deleteUser);

module.exports = router;
