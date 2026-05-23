const express = require('express');
const router = express.Router();
const challanController = require('../controllers/challansController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/getChallanDetails', authMiddleware.authenticateToken, challanController.getChallans);
router.post('/postCaptcha', authMiddleware.authenticateToken, challanController.submitChallan);

module.exports = router;