const express = require('express');
const router = express.Router();
const {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getDoctorAppointments,
  getPatientAppointments,
  trackAppointment,
  getAvailability,
} = require('../controllers/appointments');
const { protect, authorize } = require('../middleware/auth');

router.get('/track/:trackingId', trackAppointment);
router.get('/doctor', protect, authorize('DOCTOR', 'ADMIN'), getDoctorAppointments);
router.get('/patient', protect, authorize('PATIENT', 'ADMIN'), getPatientAppointments);
router.get('/availability', protect, getAvailability);
router.get('/', protect, authorize('ADMIN'), getAppointments);
router.get('/:id', protect, getAppointment);
router.post('/', protect, createAppointment);
router.patch('/:id', protect, updateAppointment);
router.delete('/:id', protect, authorize('ADMIN'), deleteAppointment);

module.exports = router;

