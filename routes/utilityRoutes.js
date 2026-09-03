const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const utilityCtrl = require('../controllers/utilityController');

router.get('/getRideTips', utilityCtrl.getRideSafetyTips);
router.get('/getFullAnalysis', utilityCtrl.getAnalysis);

module.exports = router;