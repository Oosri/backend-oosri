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


const verifySeller = (req, res, next) => {
    const seller = req.seller;

    if (!seller) {
        return res.status(401).json({ message: "Unauthorized: No user found" });
    }

    if (!seller.isVerified) {
        return res.status(403).json({ message: "Forbidden: Only verified sellers can add products" });
    }

    next();
};


const adminAuth = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    } else {
        return res.status(403).json({ message: 'Access denied: Admins only' });
    }
};


module.exports = { sellerAuth, verifySeller, adminAuth };