const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100,
    message: "Too many OTP requests. Please try again later."
});

router.post('/register', otpLimiter, authController.register);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);
router.patch('/updatePin', authController.updatePin);
router.post('/setPin', authController.setPin);
router.get('/getOTP', authController.generateOTPRequest);
router.get('/user-det', authMiddleware.authenticateToken, authController.getUserInfo);
router.post('/request-delete', authMiddleware.authenticateToken, authController.deleteAccount);
router.delete('/confirm-delete', authMiddleware.authenticateToken, authController.confirmAccountDeletion);

module.exports = router;
