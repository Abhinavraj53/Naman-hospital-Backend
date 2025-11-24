const Doctor = require('../models/Doctor');
const User = require('../models/User');
const cloudinary = require('../utils/cloudinary');

// @desc    Get all doctors
// @route   GET /api/doctors
// @access  Public
exports.getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ isActive: true }).populate('userId', 'email phone');
    res.json({ doctors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get featured doctors
// @route   GET /api/doctors/featured
// @access  Public
exports.getFeaturedDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ isFeatured: true, isActive: true }).populate(
      'userId',
      'email phone'
    );
    res.json({ doctors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single doctor
// @route   GET /api/doctors/:id
// @access  Public
exports.getDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate('userId', 'email phone');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.json({ doctor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create doctor
// @route   POST /api/doctors
// @access  Private/Admin
exports.createDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.create(req.body);
    res.status(201).json({ doctor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update doctor
// @route   PUT /api/doctors/:id
// @access  Private/Admin or Doctor
exports.updateDoctor = async (req, res) => {
  try {
    let doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'ADMIN' && doctor.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({ doctor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete doctor
// @route   DELETE /api/doctors/:id
// @access  Private/Admin
exports.deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    await doctor.remove();
    res.json({ message: 'Doctor deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload doctor photo to Cloudinary
// @route   POST /api/doctors/upload
// @access  Private/Admin
exports.uploadDoctorPhoto = async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) {
      return res.status(400).json({ message: 'Image data is required' });
    }

    const uploadResponse = await cloudinary.uploader.upload(file, {
      folder: 'naman-hospital/doctors',
      transformation: [{ width: 600, height: 600, crop: 'fill', gravity: 'auto' }],
    });

    res.json({
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

