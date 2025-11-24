const axios = require('axios');

const CASHFREE_API_VERSION = '2022-09-01';
const BASE_URLS = {
  prod: 'https://api.cashfree.com/pg',
  production: 'https://api.cashfree.com/pg',
  live: 'https://api.cashfree.com/pg',
  test: 'https://sandbox.cashfree.com/pg',
  sandbox: 'https://sandbox.cashfree.com/pg',
};

function getBaseUrl() {
  const envKey = (process.env.CASHFREE_ENV || 'test').toLowerCase();
  return BASE_URLS[envKey] || BASE_URLS.test;
}

function getHeaders() {
  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    throw new Error('Cashfree credentials are not configured');
  }

  return {
    'x-client-id': process.env.CASHFREE_APP_ID,
    'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    'x-api-version': CASHFREE_API_VERSION,
    'Content-Type': 'application/json',
  };
}

async function createOrder(payload) {
  const url = `${getBaseUrl()}/orders`;
  const { data } = await axios.post(url, payload, { headers: getHeaders() });
  return data;
}

async function getOrder(orderId) {
  const url = `${getBaseUrl()}/orders/${orderId}`;
  const { data } = await axios.get(url, { headers: getHeaders() });
  return data;
}

module.exports = {
  createOrder,
  getOrder,
};


