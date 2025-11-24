const nodemailer = require('nodemailer');

module.exports = async function sendEmail({ to, subject, html }) {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[Email] SMTP credentials not configured. Skipping email send.');
    throw new Error('Email credentials not configured');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `Naman Hospital <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`[Email] Message sent to ${to}. MessageId: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('[Email] Error sending email:', error.message);
    throw error;
  }
};

