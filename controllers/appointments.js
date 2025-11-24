const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const sendEmail = require('../utils/sendEmail');

const SLOT_MINUTES = Number(process.env.APPOINTMENT_SLOT_MINUTES || 15);
const CLINIC_DAY_START = process.env.CLINIC_DAY_START || '09:00';
const CLINIC_DAY_END = process.env.CLINIC_DAY_END || '17:00';

// @desc    Get all appointments (Admin)
// @route   GET /api/appointments
// @access  Private/Admin
exports.getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name specialty')
      .sort({ createdAt: -1 });

    res.json({ appointments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single appointment
// @route   GET /api/appointments/:id
// @access  Private
exports.getAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name specialty');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json({ appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create appointment
// @route   POST /api/appointments
// @access  Private
exports.createAppointment = async (req, res) => {
  try {
    const { doctorId, date, timeSlot, notes } = req.body;

    if (req.user.role === 'PATIENT') {
      return res.status(403).json({
        message: 'Patients must complete online payment to book appointments. Please use the checkout flow.',
      });
    }

    if (!doctorId || !date || !timeSlot) {
      return res.status(400).json({ message: 'Doctor, date and time slot are required' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const normalizedDate = normalizeDate(date);
    const conflict = await Appointment.findOne({
      doctorId: doctor._id,
      date: normalizedDate,
      timeSlot
    });

    if (conflict) {
      return res.status(409).json({ message: 'This slot has already been booked. Please choose another one.' });
    }

    const appointment = await Appointment.create({
      doctorId: doctor._id,
      patientId: req.user.id,
      date: normalizedDate,
      timeSlot,
      notes,
      status: 'PENDING',
    });

    res.status(201).json({ appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update appointment
// @route   PATCH /api/appointments/:id
// @access  Private
exports.updateAppointment = async (req, res) => {
  try {
    let appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check authorization
    if (req.user.role !== 'ADMIN') {
      const doctorProfile = await Doctor.findOne({ userId: req.user.id });
      if (!doctorProfile || appointment.doctorId.toString() !== doctorProfile._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    const previousStatus = appointment.status;
    appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    )
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty');

    if (req.body.status && req.body.status !== previousStatus) {
      await notifyPatientStatusChange(appointment, req.body.status);
    }

    res.json({ appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const statusEmailContent = {
  CONFIRMED: {
    subject: 'Your appointment is confirmed',
    getBody: (appointment) => `
      <p>Hi ${appointment.patientId?.name || 'there'},</p>
      <p>Your appointment with ${appointment.doctorId?.name || 'our doctor'} on ${appointment.date?.toLocaleString() || 'the scheduled date'} has been <strong>confirmed</strong>.</p>
      <p>Please arrive 10 minutes early with your previous medical records (if any).</p>
      <p>— Naman Hospital Team</p>
    `,
  },
  COMPLETED: {
    subject: 'Appointment completed',
    getBody: (appointment) => `
      <p>Hi ${appointment.patientId?.name || 'there'},</p>
      <p>Your appointment with ${appointment.doctorId?.name || 'our doctor'} has been marked as <strong>completed</strong>.</p>
      <p>Thank you for trusting Naman Hospital. We wish you good health!</p>
      <p>— Naman Hospital Team</p>
    `,
  },
  CANCELLED: {
    subject: 'Appointment cancelled',
    getBody: (appointment) => `
      <p>Hi ${appointment.patientId?.name || 'there'},</p>
      <p>Your appointment with ${appointment.doctorId?.name || 'our doctor'} scheduled on ${appointment.date?.toLocaleString() || 'the scheduled date'} has been <strong>cancelled</strong>.</p>
      <p>Please contact us if you would like to reschedule.</p>
      <p>— Naman Hospital Team</p>
    `,
  },
};

async function notifyPatientStatusChange(appointment, status) {
  if (!appointment?.patientId?.email) {
    console.warn('[Email] Unable to notify patient: email not available');
    return;
  }

  const template = statusEmailContent[status];
  if (!template) return;

  try {
    await sendEmail({
      to: appointment.patientId.email,
      subject: template.subject,
      html: template.getBody(appointment),
    });
    console.log(`[Email] Appointment ${status} notification sent to ${appointment.patientId.email}`);
  } catch (error) {
    console.error(`[Email] Failed to send appointment ${status} notification:`, error.message);
  }
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function combineDateTimeISO(dateValue, timeValue) {
  const [hours, minutes] = timeValue.split(':').map(Number);
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid appointment date');
  }
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
}

function formatTimeValue(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatSlotLabel(date) {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

async function buildLocalAvailability(doctorId, date) {
  const normalizedDate = normalizeDate(date);
  const startDate = combineDateTimeISO(date, CLINIC_DAY_START);
  const endDate = combineDateTimeISO(date, CLINIC_DAY_END);

  const existingAppointments = await Appointment.find({
    doctorId,
    date: normalizedDate
  });

  const takenSlots = new Set(existingAppointments.map(appt => appt.timeSlot));

  const slots = [];
  let cursor = new Date(startDate);
  const endCursor = new Date(endDate);

  while (cursor < endCursor) {
    const slotValue = formatTimeValue(cursor);
    const slotEnd = new Date(cursor.getTime() + SLOT_MINUTES * 60000);
    slots.push({
      start: cursor.toISOString(),
      end: slotEnd.toISOString(),
      value: slotValue,
      label: formatSlotLabel(cursor),
      available: !takenSlots.has(slotValue)
    });
    cursor = slotEnd;
  }

  return slots;
}

exports.getAvailability = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ message: 'doctorId and date are required' });
    }

    const slots = await buildLocalAvailability(doctorId, date);

    res.json({
      doctorId,
      date,
      slots
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Private/Admin
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    await appointment.remove();
    res.json({ message: 'Appointment deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get doctor appointments
// @route   GET /api/appointments/doctor
// @access  Private/Doctor
exports.getDoctorAppointments = async (req, res) => {
  try {
    const doctorProfile = await Doctor.findOne({ userId: req.user.id });
    if (!doctorProfile) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    const appointments = await Appointment.find({ doctorId: doctorProfile._id })
      .populate('patientId', 'name email phone')
      .sort({ date: 1 });

    res.json({ appointments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get patient appointments
// @route   GET /api/appointments/patient
// @access  Private/Patient
exports.getPatientAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.id })
      .populate('doctorId', 'name specialty photoUrl')
      .sort({ date: -1 });

    res.json({ appointments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Track appointment by tracking ID
// @route   GET /api/appointments/track/:trackingId
// @access  Public
exports.trackAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      trackingId: req.params.trackingId.toUpperCase(),
    })
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json({ appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

