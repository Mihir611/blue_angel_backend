const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.authenticateToken, profileController.getProfile);
router.put('/', authMiddleware.authenticateToken, profileController.updateProfile);
router.put('/change-password', authMiddleware.authenticateToken, profileController.changePassword);

module.exports = router;