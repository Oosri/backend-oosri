const mongoose = require('mongoose');

const ping = async (name, fn) => {
  const start = Date.now();
  try {
    await fn();
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - start, error: err.message };
  }
};

module.exports.checkAll = async () => {
  const checkedAt = new Date().toISOString();

  const [mongodb, redis, stripe, paystack, dhl, fedex, algolia, cloudinary, email] = await Promise.all([
    ping('mongodb', async () => {
      if (mongoose.connection.readyState !== 1) throw new Error('Not connected');
    }),

    ping('redis', async () => {
      const { createClient } = require('redis');
      const url = process.env.REDIS_URL || process.env.REDIS_URI;
      if (!url) throw new Error('REDIS_URL not configured');
      const client = createClient({ url });
      await client.connect();
      await client.ping();
      await client.disconnect();
    }),

    ping('stripe', async () => {
      const Stripe = require('stripe');
      const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY;
      if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
      const stripe = Stripe(key);
      await stripe.balance.retrieve();
    }),

    ping('paystack', async () => {
      const axios = require('axios');
      const key = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY;
      if (!key) throw new Error('PAYSTACK_SECRET_KEY not configured');
      await axios.get('https://api.paystack.co/balance', {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 8000,
      });
    }),

    ping('dhl', async () => {
      const axios = require('axios');
      const key = process.env.DHL_API_KEY;
      if (!key) throw new Error('DHL_API_KEY not configured');
      await axios.get('https://api-mock.dhl.com/mydhlapi/shipments', {
        headers: { 'DHL-API-Key': key },
        timeout: 8000,
      });
    }),

    ping('fedex', async () => {
      const key = process.env.FEDEX_API_KEY;
      if (!key) throw new Error('FEDEX_API_KEY not configured');
    }),

    ping('algolia', async () => {
      const { algoliasearch } = require('algoliasearch');
      const appId  = process.env.ALGOLIA_APP_ID;
      const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
      if (!appId || !apiKey) throw new Error('Algolia credentials not configured');
      const client = algoliasearch(appId, apiKey);
      await client.listIndices();
    }),

    ping('cloudinary', async () => {
      const cloudinary = require('cloudinary').v2;
      if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary not configured');
      await cloudinary.api.ping();
    }),

    ping('email', async () => {
      const nodemailer = require('nodemailer');
      const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
      const user = process.env.SMTP_USER || process.env.EMAIL_USER;
      if (!host || !user) throw new Error('SMTP credentials not configured');
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: { user, pass: process.env.SMTP_PASS || process.env.EMAIL_PASS },
      });
      await transporter.verify();
    }),
  ]);

  return {
    checkedAt,
    services: { mongodb, redis, stripe, paystack, dhl, fedex, algolia, cloudinary, email },
  };
};
