const axios = require('axios');

class DHLService {
  constructor() {
    this.apiUrl = process.env.DHL_API_URL;
    this.apiKey = process.env.DHL_API_KEY;
    this.refreshUrl = process.env.DHL_REFRESH_TOKEN_URL;
    this.apiKey = process.env.DHL_API_KEY;
    this.userId = process.env.DHL_USER_ID;
    this.accountNumbers = process.env.DHL_ACCOUNT_NUMBERS.split(',');
  }

  async getDeliveryRate(shipmentDetails, accessToken) {
    try {
      const response = await axios.post(
        this.apiUrl,
        shipmentDetails,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching delivery rates from DHL:', error.message);
      throw new Error('Unable to fetch delivery rates');
    }
  }

  async getAccessToken() {
    try {
      const response = await axios.post(this.urls.api, this.credentials);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to authenticate: ${error.response?.data?.message || error.message}`);
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(this.urls.refresh, { refreshToken });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = new DHLService();
