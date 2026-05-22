const buyerDHLService = require('./buyerDHLService');
const buyerHaulamService = require('./buyerHaulamService');

const SUPPORTED_PROVIDERS = Object.freeze({
  DHL: 'DHL',
  HAULAM: 'HAULAM',
});

const normalizeShippingProvider = (provider) => {
  if (!provider || typeof provider !== 'string') {
    return null;
  }

  const normalized = provider.trim().toUpperCase();
  return SUPPORTED_PROVIDERS[normalized] || null;
};

const getDefaultShippingProvider = () => {
  return normalizeShippingProvider(process.env.DEFAULT_PROVIDER) || SUPPORTED_PROVIDERS.DHL;
};

const getDefaultShippingProviderForAddress = (deliveryAddress = {}) => {
  if (deliveryAddress.countryCode && deliveryAddress.countryCode !== 'NG') {
    return SUPPORTED_PROVIDERS.HAULAM;
  }

  return getDefaultShippingProvider();
};

const getShippingProviderAdapter = (provider = null) => {
  const selectedProvider = normalizeShippingProvider(provider) || getDefaultShippingProvider();

  if (selectedProvider === SUPPORTED_PROVIDERS.HAULAM) {
    return {
      provider: selectedProvider,
      adapter: buyerHaulamService,
    };
  }

  return {
    provider: SUPPORTED_PROVIDERS.DHL,
    adapter: buyerDHLService,
  };
};

const isHaulamProviderActive = () => getDefaultShippingProvider() === SUPPORTED_PROVIDERS.HAULAM;

module.exports = {
  SUPPORTED_PROVIDERS,
  normalizeShippingProvider,
  getDefaultShippingProvider,
  getDefaultShippingProviderForAddress,
  getShippingProviderAdapter,
  isHaulamProviderActive,

  async validateAddress(params) {
    const { adapter, provider } = getShippingProviderAdapter(params?.provider);
    const response = await adapter.validateAddress(params);
    return {
      provider,
      response,
    };
  },

  async getDeliveryRate(params) {
    const { adapter, provider } = getShippingProviderAdapter(params?.provider);
    const response = await adapter.getDeliveryRate(params);
    return {
      provider,
      response,
    };
  },

  async createShipment(params) {
    const { adapter, provider } = getShippingProviderAdapter(params?.provider);
    const action = typeof adapter.createShipment === 'function'
      ? adapter.createShipment.bind(adapter)
      : adapter.schedulePickup.bind(adapter);

    const response = await action(params);
    return {
      provider,
      response,
    };
  },
};
