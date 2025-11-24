const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

dotenv.config({ path: path.join(__dirname, '../.env') });

const syncDoctors = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const doctors = await User.find({ role: 'DOCTOR' });
    let created = 0;

    for (const docUser of doctors) {
      const existing = await Doctor.findOne({ userId: docUser._id });
      if (!existing) {
        await Doctor.create({
          userId: docUser._id,
          name: docUser.name,
          specialty: 'Medicine',
          hospital: 'Naman Hospital, Darbhanga',
          photoUrl: '/mediplus-images/doc-1.jpg'
        });
        created += 1;
        console.log(`Created doctor profile for ${docUser.name}`);
      }
    }

    console.log(`Finished syncing. Profiles created: ${created}`);
    process.exit(0);
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
};

syncDoctors();
