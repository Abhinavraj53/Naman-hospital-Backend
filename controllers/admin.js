const User = require('../models/User');
const Doctor = require('../models/Doctor');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Blog = require('../models/Blog');
const Contact = require('../models/Contact');
const Invoice = require('../models/Invoice');

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalPatients,
      totalDoctors,
      totalAdmins,
      totalAppointments,
      todayAppointments,
      thisWeekAppointments,
      thisMonthAppointments,
      totalBlogs,
      totalContacts,
      pendingContacts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'PATIENT' }),
      User.countDocuments({ role: 'DOCTOR' }),
      User.countDocuments({ role: 'ADMIN' }),
      Appointment.countDocuments(),
      Appointment.countDocuments({
        date: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
      Appointment.countDocuments({
        date: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      }),
      Appointment.countDocuments({
        date: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      }),
      Blog.countDocuments(),
      Contact.countDocuments(),
      Contact.countDocuments({ status: 'NEW' }),
    ]);

    res.json({
      stats: {
        users: {
          total: totalUsers,
          patients: totalPatients,
          doctors: totalDoctors,
          admins: totalAdmins,
        },
        appointments: {
          total: totalAppointments,
          today: todayAppointments,
          thisWeek: thisWeekAppointments,
          thisMonth: thisMonthAppointments,
        },
        content: {
          blogs: totalBlogs,
          contacts: totalContacts,
          pendingContacts: pendingContacts,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;
    const query = role ? { role } : {};

    const users = await User.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all appointments
// @route   GET /api/admin/appointments
// @access  Private/Admin
exports.getAllAppointments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name specialty consultationFee userId')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Enrich appointments with doctor specialty from Doctor model
    const total = await Appointment.countDocuments(query);

    res.json({
      appointments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get revenue statistics
// @route   GET /api/admin/revenue
// @access  Private/Admin
exports.getRevenueStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { status: 'PAID' };
    if (startDate && endDate) {
      query.paidAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const invoices = await Invoice.find(query);
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalInvoices = invoices.length;

    res.json({
      totalRevenue,
      totalInvoices,
      averageInvoice: totalInvoices > 0 ? totalRevenue / totalInvoices : 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get analytics data
// @route   GET /api/admin/analytics
// @access  Private/Admin
exports.getAnalytics = async (req, res) => {
  try {
    // Appointment status distribution
    const appointmentStatus = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Appointments by month
    const appointmentsByMonth = await Appointment.aggregate([
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top doctors by appointments
    const topDoctors = await Appointment.aggregate([
      {
        $group: {
          _id: '$doctorId',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor',
        },
      },
    ]);

    res.json({
      appointmentStatus,
      appointmentsByMonth,
      topDoctors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new user
// @route   POST /api/admin/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'PATIENT',
      phone,
      isEmailVerified: role === 'DOCTOR' ? false : true
    });

    if ((role || 'PATIENT') === 'DOCTOR') {
      await Doctor.create({
        userId: user._id,
        name: user.name,
        specialty: req.body.specialty || 'General Physician',
        hospital: req.body.hospital || 'Naman Hospital, Darbhanga',
        photoUrl: req.body.photoUrl || '/mediplus-images/doc-1.jpg',
        experience: req.body.experience || 0,
        bio: req.body.bio,
        consultationFee: req.body.consultationFee || 0,
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        education: req.body.education || [],
        tags: req.body.tags || []
      });
    }

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, role, phone, isActive, password } = req.body;

    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }

    const roleChanged = role && role !== user.role;

    if (name) user.name = name;
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (password) user.password = password;

    await user.save();

    if (roleChanged && role === 'DOCTOR') {
      await Doctor.create({
        userId: user._id,
        name: user.name,
        specialty: req.body.specialty || 'General Physician',
        hospital: req.body.hospital || 'Naman Hospital, Darbhanga',
        photoUrl: req.body.photoUrl || '/mediplus-images/doc-1.jpg',
        experience: req.body.experience || 0,
        bio: req.body.bio,
        consultationFee: req.body.consultationFee || 0,
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        education: req.body.education || [],
        tags: req.body.tags || []
      });
    } else if (roleChanged && user.role !== 'DOCTOR') {
      await Doctor.deleteOne({ userId: user._id });
    } else if (user.role === 'DOCTOR') {
      await Doctor.findOneAndUpdate(
        { userId: user._id },
        {
          name: user.name,
          specialty: req.body.specialty || 'General Physician',
          hospital: req.body.hospital || 'Naman Hospital, Darbhanga',
          photoUrl: req.body.photoUrl || '/mediplus-images/doc-1.jpg',
          experience: req.body.experience || 0,
          bio: req.body.bio,
          consultationFee: req.body.consultationFee || 0,
          addressLine1: req.body.addressLine1,
          addressLine2: req.body.addressLine2,
          education: req.body.education || [],
          tags: req.body.tags || []
        },
        { upsert: true }
      );
    }

    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, isActive: user.isActive }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.deleteOne();
    if (user.role === 'DOCTOR') {
      await Doctor.deleteOne({ userId: user._id });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

