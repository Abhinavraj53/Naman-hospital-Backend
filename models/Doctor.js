const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    specialty: {
      type: String,
      required: true,
      enum: [
        'Medicine',
        'Chest Disease',
        'Skin Disease',
        'Gynaecology & Obstetrics',
        'Pediatrics',
        'General Surgery',
        'Orthopedics',
        'Plastic Surgery',
        'General Physician',
        'ENT',
        'Ophthalmology',
        'Psychiatry',
      ],
    },
    hospital: {
      type: String,
      default: 'नमन हॉस्पिटल दरभंगा (Naman Hospital, Darbhanga)',
    },
    photoUrl: {
      type: String,
      default: '/mediplus-images/doc-1.jpg',
    },
    bio: {
      type: String,
    },
    experience: {
      type: Number,
      default: 0,
    },
    education: [String],
    languages: [String],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    tags: [String],
    consultationFee: {
      type: Number,
      default: 500,
    },
    addressLine1: String,
    addressLine2: String,
    availability: {
      monday: { start: String, end: String, available: Boolean },
      tuesday: { start: String, end: String, available: Boolean },
      wednesday: { start: String, end: String, available: Boolean },
      thursday: { start: String, end: String, available: Boolean },
      friday: { start: String, end: String, available: Boolean },
      saturday: { start: String, end: String, available: Boolean },
      sunday: { start: String, end: String, available: Boolean },
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Doctor', doctorSchema);

