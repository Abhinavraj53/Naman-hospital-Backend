const crypto = require('crypto');
const PaymentIntent = require('../models/PaymentIntent');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const cashfree = require('../utils/cashfree');
const sendEmail = require('../utils/sendEmail');

const DEFAULT_FEE = Number(process.env.DEFAULT_CONSULTATION_FEE || 500);
const SERVER_PUBLIC_URL = (process.env.BACKEND_PUBLIC_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, '');
const CLIENT_BASE_URL = resolvePaymentReturnBase();
const PAYMENT_WEBHOOK_URL = resolveWebhookUrl();
const PENDING_GRACE_MS = Number(process.env.PAYMENT_PENDING_GRACE_MINUTES || 10) * 60 * 1000; // default 10 minutes

const normalizeDate = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

exports.createCashfreeOrder = async (req, res) => {
  try {
    const { doctorId, date, timeSlot, notes } = req.body;

    if (!doctorId || !date || !timeSlot) {
      return res.status(400).json({ message: 'Doctor, date and time slot are required' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.isActive) {
      return res.status(404).json({ message: 'Doctor not found or not active' });
    }

    const normalizedDate = normalizeDate(date);
    const existingAppointment = await Appointment.findOne({
      doctorId: doctor._id,
      date: normalizedDate,
      timeSlot,
    });

    if (existingAppointment) {
      return res.status(409).json({ message: 'This slot has already been booked. Please choose another one.' });
    }

    const pendingIntent = await PaymentIntent.findOne({
      doctorId: doctor._id,
      date: normalizedDate,
      timeSlot,
      status: 'PENDING',
    });

    if (pendingIntent) {
      const isStale = Date.now() - new Date(pendingIntent.createdAt).getTime() > PENDING_GRACE_MS;
      if (!isStale) {
        return res.status(409).json({
          message:
            'Another payment is already in progress for this slot. Please wait a few minutes or pick a different slot.',
        });
      }

      pendingIntent.status = 'EXPIRED';
      pendingIntent.rawWebhookPayload = {
        expiredAt: new Date().toISOString(),
        reason: 'Expired automatically after pending grace window',
      };
      await pendingIntent.save();
    }

    const amount = Number(doctor.consultationFee || DEFAULT_FEE);
    const orderId = `NAMCF-${Date.now()}`;
    const notifyUrl = PAYMENT_WEBHOOK_URL;
    const returnUrl = `${CLIENT_BASE_URL}/payment-status?order_id=${orderId}`;

    const cashfreePayload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: req.user.id.toString(),
        customer_email: req.user.email,
        customer_phone: req.user.phone || process.env.DEFAULT_PATIENT_PHONE || '9999999999',
        customer_name: req.user.name,
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
      },
      order_note: `Consultation with ${doctor.name} on ${normalizedDate.toDateString()} @ ${timeSlot}`,
    };

    const orderResponse = await cashfree.createOrder(cashfreePayload);

    const hostedPaymentLink = buildHostedCheckoutLink(orderResponse, orderId);

    await PaymentIntent.create({
      orderId,
      paymentSessionId: orderResponse.payment_session_id,
      paymentLink: hostedPaymentLink,
      amount,
      currency: 'INR',
      patientId: req.user.id,
      doctorId: doctor._id,
      date: normalizedDate,
      timeSlot,
      notes,
    });

    return res.status(201).json({
      orderId,
      paymentSessionId: orderResponse.payment_session_id,
      paymentLink: hostedPaymentLink,
      amount,
      currency: 'INR',
      doctor: {
        id: doctor._id,
        name: doctor.name,
        specialty: doctor.specialty,
      },
    });
  } catch (error) {
    console.error('[Cashfree] Order creation failed:', error.response?.data || error.message);
    return res.status(500).json({ message: error.response?.data?.message || 'Unable to start payment. Please try again.' });
  }
};

exports.getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const paymentIntent = await PaymentIntent.findOne({ orderId })
      .populate('appointmentId', 'trackingId status')
      .populate('doctorId', 'name specialty')
      .populate('patientId', 'name email');

    if (!paymentIntent) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role !== 'ADMIN' && paymentIntent.patientId?._id?.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    return res.json({
      order: {
        orderId: paymentIntent.orderId,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        appointment: paymentIntent.appointmentId || null,
        doctor: paymentIntent.doctorId,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.cashfreeWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const payloadString = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    if (!verifySignature(payloadString, signature)) {
      console.error('[Cashfree] Invalid webhook signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const payload = JSON.parse(payloadString);
    const orderId = payload?.data?.order?.order_id;
    if (!orderId) {
      return res.status(200).json({ received: true });
    }

    const paymentIntent = await PaymentIntent.findOne({ orderId }).populate('doctorId patientId');
    if (!paymentIntent) {
      return res.status(200).json({ message: 'Order not tracked' });
    }

    const paymentStatus = payload?.data?.payment?.payment_status;
    if (paymentStatus !== 'SUCCESS') {
      paymentIntent.status = paymentStatus === 'FAILED' ? 'FAILED' : 'EXPIRED';
      paymentIntent.rawWebhookPayload = payload;
      await paymentIntent.save();
      return res.status(200).json({ message: 'Payment not successful' });
    }

    if (paymentIntent.status === 'PAID') {
      return res.status(200).json({ message: 'Already processed' });
    }

    const conflict = await Appointment.findOne({
      doctorId: paymentIntent.doctorId._id,
      date: paymentIntent.date,
      timeSlot: paymentIntent.timeSlot,
    });

    if (conflict) {
      paymentIntent.status = 'FAILED';
      paymentIntent.rawWebhookPayload = payload;
      await paymentIntent.save();
      console.error('[Cashfree] Slot conflict after payment for order:', orderId);
      return res.status(200).json({ message: 'Slot already taken' });
    }

    const appointment = await Appointment.create({
      doctorId: paymentIntent.doctorId._id,
      patientId: paymentIntent.patientId._id,
      date: paymentIntent.date,
      timeSlot: paymentIntent.timeSlot,
      notes: paymentIntent.notes,
      status: 'CONFIRMED',
      amount: paymentIntent.amount,
      paymentStatus: 'PAID',
      paymentProvider: 'CASHFREE',
      paymentOrderId: orderId,
      paymentReferenceId: payload?.data?.payment?.cf_payment_id || payload?.data?.payment?.bank_reference || '',
      paymentMode: payload?.data?.payment?.payment_method,
    });

    paymentIntent.status = 'PAID';
    paymentIntent.appointmentId = appointment._id;
    paymentIntent.paymentReferenceId = payload?.data?.payment?.cf_payment_id;
    paymentIntent.paymentMode = payload?.data?.payment?.payment_method;
    paymentIntent.rawWebhookPayload = payload;
    await paymentIntent.save();

    await sendEmail({
      to: paymentIntent.patientId.email,
      subject: 'Appointment booked successfully',
      html: `
        <p>Hi ${paymentIntent.patientId.name || 'Patient'},</p>
        <p>Your payment was received and your appointment with <strong>${paymentIntent.doctorId.name}</strong> is confirmed.</p>
        <p><strong>Date:</strong> ${appointment.date.toDateString()}<br/>
        <strong>Slot:</strong> ${appointment.timeSlot}<br/>
        <strong>Tracking ID:</strong> ${appointment.trackingId}</p>
        <p>Thank you for choosing Naman Hospital.</p>
      `,
    });

    return res.status(200).json({ processed: true });
  } catch (error) {
    console.error('[Cashfree] Webhook error:', error.message);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

function verifySignature(payload, signature) {
  if (!signature || !process.env.CASHFREE_SECRET_KEY) return false;
  const computed = crypto.createHmac('sha256', process.env.CASHFREE_SECRET_KEY).update(payload).digest('base64');
  return computed === signature;
}

function resolvePaymentReturnBase() {
  const raw =
    process.env.FRONTEND_PAYMENT_URL ||
    process.env.FRONTEND_URL ||
    'https://localhost:5173';
  return ensureHttpsUrl(raw, 'FRONTEND_URL');
}

function resolveWebhookUrl() {
  const raw =
    process.env.PAYMENT_WEBHOOK_URL ||
    `${SERVER_PUBLIC_URL}/api/payments/cashfree-webhook`;
  return ensureHttpsUrl(raw, 'PAYMENT_WEBHOOK_URL');
}

function ensureHttpsUrl(raw, label = 'URL') {
  if (!raw) {
    throw new Error(`[Cashfree] ${label} is not configured`);
  }

  const trimmed = raw.trim().replace(/\/$/, '');

  if (trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://')) {
    const upgraded = `https://${trimmed.substring('http://'.length)}`;
    console.warn(`[Cashfree] ${label} must be HTTPS. Upgrading to ${upgraded}`);
    return upgraded;
  }

  const prefixed = `https://${trimmed}`;
  console.warn(`[Cashfree] ${label} missing protocol. Using ${prefixed}`);
  return prefixed;
}

function buildHostedCheckoutLink(orderResponse, fallbackOrderId) {
  const orderId = orderResponse?.order_id || fallbackOrderId;
  const paymentSessionId = orderResponse?.payment_session_id;
  if (!orderId) {
    return '';
  }

  const envKey = (process.env.CASHFREE_ENV || 'test').toLowerCase();
  const isProd = ['prod', 'production', 'live'].includes(envKey);
  const baseUrl = isProd ? 'https://payments.cashfree.com/order' : 'https://payments.cashfree.com/order';

  if (paymentSessionId) {
    return `${baseUrl}/#/?payment_session_id=${encodeURIComponent(paymentSessionId)}`;
  }

  return `${baseUrl}/#/?order_id=${encodeURIComponent(orderId)}`;
}


