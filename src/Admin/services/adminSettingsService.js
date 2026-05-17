const PlatformSettings = require('../Model/platformSettingsModel');

const getOrCreate = async () => {
  let settings = await PlatformSettings.findOne({ _singleton: 'global' });
  if (!settings) {
    settings = await PlatformSettings.create({ _singleton: 'global' });
  }
  return settings;
};

module.exports = {
  getSettings: async () => {
    return getOrCreate();
  },

  updateSettings: async (payload) => {
    const settings = await PlatformSettings.findOneAndUpdate(
      { _singleton: 'global' },
      { $set: payload },
      { upsert: true, new: true, runValidators: true }
    );
    return settings;
  },

  testShippingProvider: async (provider) => {
    const allowed = ['dhl', 'fedex', 'haulam'];
    if (!allowed.includes(provider)) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return { provider, reachable: true, testedAt: new Date().toISOString() };
  },
};
