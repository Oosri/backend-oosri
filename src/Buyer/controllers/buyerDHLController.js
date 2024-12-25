const buyerDHLService = require('../Service/buyerDHLService');
const { validationResult } = require('express-validator');



class DHLController {
  async calculateDeliveryFee(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, delivery, packageDetails, currency = 'USD' } = req.body;

    try {
      const shipmentDetails = { shipmentDetails: { pickup, delivery }, packageDetails, currency };
      const rate = await buyerDHLService.getDeliveryRate(shipmentDetails, req.accessToken);
      return res.status(200).json(rate);
    } catch (error) {
      console.error('Error calculating delivery fee:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}


module.exports = new DHLController();
