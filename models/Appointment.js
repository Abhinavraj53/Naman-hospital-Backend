const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    trackingId: {
      type: String,
      unique: true,
      uppercase: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    notes: {
      type: String,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    amount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PENDING', 'PAID', 'REFUNDED', 'FAILED'],
      default: 'UNPAID',
    },
    paymentProvider: String,
    paymentOrderId: String,
    paymentReferenceId: String,
    paymentMode: String,
  },
  {
    timestamps: true,
  }
);

// Generate tracking ID before saving
appointmentSchema.pre('save', async function (next) {
  if (!this.trackingId) {
    const count = await mongoose.model('Appointment').countDocuments();
    this.trackingId = `NAM-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);

