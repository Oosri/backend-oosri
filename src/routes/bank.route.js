const express = require('express');
const { getBanks, resolveBankAccount } = require('../controllers/bank.controller');
const router = express.Router();

/**
 * @route   GET /api/v1/bank
 * @desc    Get list of banks
 * @access  Public
 */
router.get('/', getBanks);

/**
 * @route   GET /api/v1/bank/resolve
 * @desc    Verify bank account
 * @access  Public
 */
router.get('/resolve', resolveBankAccount);

module.exports = router;
