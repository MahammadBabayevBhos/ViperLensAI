const express = require('express');
const checkoutController = require('../controllers/checkoutController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/checkout', requireAuth, checkoutController.renderCheckout);
router.post('/checkout/complete', requireAuth, checkoutController.completeCheckout);

module.exports = router;
