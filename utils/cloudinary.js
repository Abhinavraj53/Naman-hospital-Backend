const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment variables
// Cloudinary automatically reads from CLOUDINARY_URL if set
// Otherwise, use individual credentials
if (process.env.CLOUDINARY_URL) {
  // Cloudinary automatically parses CLOUDINARY_URL from environment
  cloudinary.config();
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  console.warn('⚠️  Cloudinary credentials not found. Image uploads will fail.');
}

module.exports = cloudinary;

