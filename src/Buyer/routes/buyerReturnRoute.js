const express = require('express');
const router = express.Router();
const buyerReturnController = require('../controllers/buyerReturnController');
const { validateToken } = require('../middlewares/accessControlValidation');

router.post('/',
  validateToken,
  buyerReturnController.createReturnRequest
);

router.get('/',
  validateToken,
  buyerReturnController.getMyReturns
);

router.get('/:id',
  validateToken,
  buyerReturnController.getReturnById
);

module.exports = router;
