const express = require('express');
const router  = express.Router();
const { sellerAuth }    = require('../middlewares/auth.middleware');
const validateObjectId  = require('../middlewares/validateObjectId');
const ctrl = require('../controllers/sellerReturnController');

router.use(sellerAuth);

router.get('/',    ctrl.getMyReturns);
router.get('/:id', validateObjectId('id'), ctrl.getReturnById);

router.patch('/:id/approve', validateObjectId('id'), ctrl.approveReturn);
router.patch('/:id/reject',  validateObjectId('id'), ctrl.rejectReturn);

module.exports = router;
