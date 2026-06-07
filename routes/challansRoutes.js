const express = require('express');
const router = express.Router();
const challanController = require('../controllers/challansController');
const authMiddleware = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const challanRateLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, //24 hours
    max: 3,
    message: {
        status: 429,
        error: 'Too many requests. You can only make 3 requests per day. Please try again tomorrow.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/getChallanDetails', authMiddleware.authenticateToken, challanRateLimiter, challanController.getChallans);
router.post('/postCaptcha', authMiddleware.authenticateToken, challanRateLimiter, challanController.submitChallan);

module.exports = router;