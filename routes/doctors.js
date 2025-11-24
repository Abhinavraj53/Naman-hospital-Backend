const express = require('express');
const router = express.Router();
const {
  getDoctors,
  getFeaturedDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  uploadDoctorPhoto,
} = require('../controllers/doctors');
const { protect, authorize } = require('../middleware/auth');

router.get('/featured', getFeaturedDoctors);
router.get('/', getDoctors);
router.get('/:id', getDoctor);
router.post('/', protect, authorize('ADMIN'), createDoctor);
router.post('/upload', protect, authorize('ADMIN'), uploadDoctorPhoto);
router.put('/:id', protect, authorize('ADMIN', 'DOCTOR'), updateDoctor);
router.delete('/:id', protect, authorize('ADMIN'), deleteDoctor);

module.exports = router;

