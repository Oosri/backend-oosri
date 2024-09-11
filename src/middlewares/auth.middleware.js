const Seller = require('../models/sellerModel');
const jwt = require('jsonwebtoken')

const sellerAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.seller = await Seller.findById(decoded.sellerId).select('-password');
            next();
        } catch (error) {
            return res.status(401).json({ status: 401, success: false, message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ status: 401, success: false, message: 'Not authorized, no token' });
    }
}


const Admin = async (req, res, next) => { }


module.exports = { sellerAuth, Admin };