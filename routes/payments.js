const express = require('express');
const router = express.Router();
const { createCashfreeOrder, getOrderStatus } = require('../controllers/payments');
const { protect, authorize } = require('../middleware/auth');

router.post('/cashfree/order', protect, authorize('PATIENT'), createCashfreeOrder);
router.get('/order/:orderId', protect, authorize('PATIENT', 'ADMIN'), getOrderStatus);

module.exports = router;


