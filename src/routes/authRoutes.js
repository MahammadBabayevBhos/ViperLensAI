const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/login', authController.renderLogin);
router.get('/register', authController.renderRegister);
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.get('/profile', requireAuth, authController.renderProfile);
router.post('/profile', requireAuth, authController.updateProfile);
router.post('/profile/password', requireAuth, authController.changePassword);

module.exports = router;
