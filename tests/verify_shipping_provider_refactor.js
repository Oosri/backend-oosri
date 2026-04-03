const assert = require('assert');
const proxyquire = require('proxyquire');

process.env.STRIPE_PAYMENT_TEST_KEY = process.env.STRIPE_PAYMENT_TEST_KEY || 'sk_test_dummy';

const shippingProviderService = require('../src/Buyer/Service/shippingProviderService');
const buyersPaymentController = proxyquire('../src/Buyer/controllers/buyersPaymentController', {
  '../Service/paymentService': { createPaymentIntent: async () => ({}) },
  '../models/paymentModel': {},
  '../models/buyerOrderModel': {},
  '../models/buyerAuthModel': {},
  '../../models/productModel': { Product: {} },
  mongoose: { startSession: async () => ({}) },
  stripe: () => ({}),
  '../../utils/paymentUtils': { validateStockAvailability: async () => [] },
  '../Service/adminControlledFxService': { getFxRateNGNtoUSD: async () => 1 / 1500 },
  '../../models/sellerLedger': {},
  '../../models/stripeEventModel': {},
  '../Service/buyerShippingService': { calculateConsolidatedShipping: async () => ({}) },
  '../Service/shippingProviderService': shippingProviderService,
  '../Service/orderLogisticsService': { processOrdersLogistics: async () => ({}) },
  '../../queues/email.queue': { addEmailJob: async () => ({}) },
  '../../models/sellerModel': {},
});

function createMockRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function testDefaultProviderSelection() {
  const originalDefaultProvider = process.env.DEFAULT_PROVIDER;

  try {
    delete process.env.DEFAULT_PROVIDER;
    assert.strictEqual(
      shippingProviderService.getDefaultShippingProvider(),
      shippingProviderService.SUPPORTED_PROVIDERS.DHL,
      'Expected DHL fallback when DEFAULT_PROVIDER is not set'
    );

    process.env.DEFAULT_PROVIDER = 'haulam';
    assert.strictEqual(
      shippingProviderService.getDefaultShippingProvider(),
      shippingProviderService.SUPPORTED_PROVIDERS.HAULAM,
      'Expected HAULAM when DEFAULT_PROVIDER=haulam'
    );
  } finally {
    if (originalDefaultProvider === undefined) {
      delete process.env.DEFAULT_PROVIDER;
    } else {
      process.env.DEFAULT_PROVIDER = originalDefaultProvider;
    }
  }
}

function testShippingAllocation() {
  const { allocateShippingFeeCents } = buyersPaymentController.__testables;

  const allocations = allocateShippingFeeCents(999, [
    { sellerId: 'sellerA', verifiedAmountCents: 4000 },
    { sellerId: 'sellerB', verifiedAmountCents: 3000 },
    { sellerId: 'sellerC', verifiedAmountCents: 3000 },
  ]);

  const totalAllocated = Array.from(allocations.values()).reduce((sum, value) => sum + value, 0);

  assert.strictEqual(totalAllocated, 999, 'Allocated shipping must sum to the original fee');
  assert.strictEqual(allocations.get('sellerA'), 399, 'sellerA should receive the largest proportional share');
  assert.strictEqual(allocations.get('sellerB'), 300, 'sellerB should receive a rounded share');
  assert.strictEqual(allocations.get('sellerC'), 300, 'sellerC should receive a rounded share');
}

async function testHaulamWebhookOrderUpdate() {
  let capturedFilter = null;
  let capturedUpdate = null;

  const webhookController = proxyquire('../src/Buyer/controllers/shippingWebhookController', {
    '../models/buyerOrderModel': {
      updateMany: async (filter, update) => {
        capturedFilter = filter;
        capturedUpdate = update;
        return { matchedCount: 2, modifiedCount: 2 };
      }
    },
    '../Service/buyerHaulamService': {
      parseWebhookPayload: () => ({
        event: 'shipment.updated',
        shipmentId: 'US-123456',
        shipmentStatus: 'Delivered',
        shipmentPaymentStatus: 'Paid',
      })
    },
    '../Service/shippingProviderService': {
      isHaulamProviderActive: () => true,
    },
    '../constants': {
      customServerResponse: { status: 400, message: '', body: {} }
    }
  });

  const req = { body: { event: 'shipment.updated' } };
  const res = createMockRes();

  await webhookController.handleHaulamWebhook(req, res);

  assert.strictEqual(res.statusCode, 200, 'Webhook should return HTTP 200');
  assert.strictEqual(capturedFilter.$or[0].shipmentId, 'US-123456', 'Webhook should match by shipmentId');
  assert.strictEqual(capturedUpdate.$set.shipmentStatus, 'Delivered', 'Webhook should persist the provider shipment status');
  assert.strictEqual(capturedUpdate.$set.shipmentPaymentStatus, 'Paid', 'Webhook should persist the provider payment status');
  assert.strictEqual(capturedUpdate.$set.orderStatus, 'completed', 'Delivered webhook should mark order as completed');
}

async function run() {
  try {
    testDefaultProviderSelection();
    testShippingAllocation();
    await testHaulamWebhookOrderUpdate();
    console.log('verify_shipping_provider_refactor: PASS');
    process.exit(0);
  } catch (error) {
    console.error('verify_shipping_provider_refactor: FAIL');
    console.error(error);
    process.exit(1);
  }
}

run();
