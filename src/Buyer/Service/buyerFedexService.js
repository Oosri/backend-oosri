const axios = require("axios");
require("dotenv").config();

const getFedExAccessToken = async () => {
  try {
    const response = await axios.post(
      `${process.env.FEDEX_API_BASE_URL}/oauth/token`, 
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.FEDEX_CLIENT_KEY,
        client_secret: process.env.FEDEX_CLIENT_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return response.data.access_token;
  } catch (error) {
    console.error("FedEx Auth Error:", error.response?.data || error.message);
    throw new Error("Failed to get FedEx access token");
  }
};

module.exports.getFedExRates = async (origin, destination, weight) => {
  try {
    const accessToken = await getFedExAccessToken();

    const requestBody = {
      accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
      requestedShipment: {
        rateRequestType: ["LIST", "ACCOUNT"],
        shipper: { address: { postalCode: origin, countryCode: "US" } },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        recipient: { address: { postalCode: destination, countryCode: "US" } },
        packageCount: "1",
        requestedPackageLineItems: [
          {
            weight: { units: "LB", value: weight },
            dimensions: { length: 10, width: 10, height: 10, units: "IN" },
          },
        ],
      },
    };

    const response = await axios.post(
      `${process.env.FEDEX_API_BASE_URL}/rate/v1/rates/quotes`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-API-Key": process.env.FEDEX_CLIENT_KEY,
        },
      }
    );

    if (!response.data?.output?.rateReplyDetails) {
      throw new Error("Invalid response format or no rates available.");
    }

   return response.data.output.rateReplyDetails.map(detail => {
  const accountRate = detail.ratedShipmentDetails.find(
    rate => rate.rateType === "ACCOUNT"
  );

  return {
    serviceName: detail.serviceName,
    shippingFee: accountRate ? accountRate.totalNetCharge : "Not available",
    currency: accountRate ? accountRate.currency : "USD",
  };
});

  } catch (error) {
    console.error("FedEx API Error:", error.response?.data || error.message);
    return {
      status: 500,
      message: "Failed to fetch FedEx shipping rates",
      error: error.response?.data || error.message,
    };
  }
};


