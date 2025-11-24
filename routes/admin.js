const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  getAllAppointments,
  getRevenueStats,
  getAnalytics,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/admin');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/appointments', getAllAppointments);
router.get('/revenue', getRevenueStats);
router.get('/analytics', getAnalytics);

module.exports = router;

