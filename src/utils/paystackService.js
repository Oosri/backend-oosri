const axios = require('axios');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const paystackClient = axios.create({
    baseURL: 'https://api.paystack.co',
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
    },
});

/**
 * Fetch list of banks from Paystack
 * @returns {Promise<Array>} List of banks
 */
const listBanks = async () => {
    try {
        const response = await paystackClient.get('/bank?currency=NGN');
        if (response.data && response.data.status) {
            return response.data.data;
        }
        throw new Error('Failed to fetch banks');
    } catch (error) {
        console.error('Error fetching banks from Paystack:', error.response?.data || error.message);
        throw new Error('Could not retrieve bank list');
    }
};

/**
 * Verify account number
 * @param {string} accountNumber 
 * @param {string} bankCode 
 * @returns {Promise<Object>} Account details
 */
const resolveAccount = async (accountNumber, bankCode) => {
    try {
        const response = await paystackClient.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
        if (response.data && response.data.status) {
            return response.data.data;
        }
        throw new Error('Account verification failed');
    } catch (error) {
        // Paystack returns 422 for invalid accounts, handle gracefully if needed
        console.error('Error verifying account:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Could not verify account');
    }
};

module.exports = {
    listBanks,
    resolveAccount,
};
