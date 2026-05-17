const ReturnSettings = require('../Model/returnSettingsModel');
const constants = require('../constants');

const getOrCreate = async () => {
  let settings = await ReturnSettings.findOne({ _singleton: 'global' });
  if (!settings) {
    settings = await ReturnSettings.create({ _singleton: 'global' });
  }
  return settings;
};

module.exports = {
  getSettings: async () => {
    try {
      const settings = await getOrCreate();
      return settings.toObject();
    } catch (error) {
      console.error('Something went wrong: Service: returnSettings.getSettings', error);
      throw new Error(error.message);
    }
  },

  updateSettings: async (updates) => {
    try {
      const allowed = [
        'enabled', 'windowDays', 'shippingCostBearer',
        'refundType', 'maxRefundPercent', 'requireEvidence',
        'autoApprove', 'allowedReasons',
      ];
      const sanitized = {};
      for (const key of allowed) {
        if (updates[key] !== undefined) sanitized[key] = updates[key];
      }

      const settings = await ReturnSettings.findOneAndUpdate(
        { _singleton: 'global' },
        { $set: sanitized },
        { upsert: true, new: true, runValidators: true }
      );
      return settings.toObject();
    } catch (error) {
      console.error('Something went wrong: Service: returnSettings.updateSettings', error);
      throw new Error(error.message);
    }
  },
};
