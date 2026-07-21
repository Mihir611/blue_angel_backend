const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/get-user', authMiddleware.authenticateToken, profileController.getProfile);
router.put('/update-user', authMiddleware.authenticateToken, profileController.updateProfile);
router.put('/change-password', authMiddleware.authenticateToken, profileController.changePassword);
router.get('/emergencyContact', authMiddleware.authenticateToken, profileController.getEmergencyContact);

module.exports = router;