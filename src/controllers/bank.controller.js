const { listBanks, resolveAccount } = require('../utils/paystackService');

/**
 * Get list of banks
 * @route GET /api/v1/bank
 */
const getBanks = async (req, res) => {
    try {
        const banks = await listBanks();
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Banks retrieved successfully',
            data: banks
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || 'Failed to retrieve banks'
        });
    }
};

/**
 * Resolve bank account
 * @route GET /api/v1/bank/resolve
 */
const resolveBankAccount = async (req, res) => {
    const { account_number, bank_code } = req.query;

    if (!account_number || !bank_code) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Account number and bank code are required'
        });
    }

    try {
        const accountDetails = await resolveAccount(account_number, bank_code);
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Account verified successfully',
            data: accountDetails
        });
    } catch (error) {
        return res.status(422).json({
            status: 422,
            success: false,
            message: error.message || 'Account verification failed'
        });
    }
};

module.exports = {
    getBanks,
    resolveBankAccount
};
