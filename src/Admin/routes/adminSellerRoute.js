const express = require("express");
const adminSellerController = require('../controllers/adminSellerController');
const accessControlValidation = require('../middleware/accessControlValidation'); // Assuming this middleware exists

const router = express.Router();

router.get('/',
    accessControlValidation.validateToken,
    accessControlValidation.isAdmin,
    adminSellerController.getAllSellers
);

router.get("/:sellerId",
    accessControlValidation.validateToken,
    accessControlValidation.isAdmin,
    adminSellerController.getSellerById
);

router.delete("/:sellerId",
    accessControlValidation.validateToken,
    accessControlValidation.isAdmin,
    adminSellerController.deleteSeller
);

module.exports = router;
