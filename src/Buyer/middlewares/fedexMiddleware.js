const axios = require("axios");
require("dotenv").config();

const getFedExToken = async () => {
  try {
    const response = await axios.post(`${process.env.FEDEX_API_BASE_URL}/oauth/token`, 
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.FEDEX_CLIENT_ID,
        client_secret: process.env.FEDEX_CLIENT_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return response.data.access_token;
  } catch (error) {
    console.error("Error getting FedEx token:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with FedEx API");
  }
};

module.exports = getFedExToken;
