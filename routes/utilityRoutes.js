const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const utilityCtrl = require('../controllers/utilityController');

router.get('/getRideTips', utilityCtrl.getRideSafetyTips);
router.get('/getQuickTips', utilityCtrl.getQuickRideTips);
router.get('/getTips', utilityCtrl.getTips);

module.exports = router;