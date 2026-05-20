describe('adminControlledFxService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  const mockRedis = () => {
    jest.mock('../src/configs/redis', () => ({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    }));
  };

  it('returns the configurable fallback rate when no admin rate exists in DB', async () => {
    process.env.FX_FALLBACK_NGN_PER_USD = '1500';
    mockRedis();
    jest.mock('../src/models/fxRateModel', () => ({
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    }));

    const { getFxRateNGNtoUSD } = require('../src/Buyer/Service/adminControlledFxService');

    const rate = await getFxRateNGNtoUSD();
    expect(rate).toBeCloseTo(1 / 1500, 10);
  });

  it('returns the admin-set rate when a valid DB document exists', async () => {
    mockRedis();
    jest.mock('../src/models/fxRateModel', () => ({
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ usdToNgnRate: 1550, isActive: true }),
      }),
    }));

    const { getFxRateNGNtoUSD } = require('../src/Buyer/Service/adminControlledFxService');

    const rate = await getFxRateNGNtoUSD();
    expect(rate).toBeCloseTo(1 / 1550, 10);
  });

  it('returns the fallback rate when DB errors and no in-memory cache exists', async () => {
    process.env.FX_FALLBACK_NGN_PER_USD = '1500';
    mockRedis();
    jest.mock('../src/models/fxRateModel', () => ({
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      }),
    }));

    const { getFxRateNGNtoUSD } = require('../src/Buyer/Service/adminControlledFxService');

    const rate = await getFxRateNGNtoUSD();
    expect(rate).toBeCloseTo(1 / 1500, 10);
  });

  it('does not use a hardcoded NGN value — rate is driven by env var', async () => {
    process.env.FX_FALLBACK_NGN_PER_USD = '1750';
    mockRedis();
    jest.mock('../src/models/fxRateModel', () => ({
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    }));

    const { getFxRateNGNtoUSD } = require('../src/Buyer/Service/adminControlledFxService');

    const rate = await getFxRateNGNtoUSD();
    expect(rate).toBeCloseTo(1 / 1750, 10);
    // Must NOT equal the old hardcoded 1/1330
    expect(rate).not.toBeCloseTo(1 / 1330, 10);
  });
});
