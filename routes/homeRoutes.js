const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.authenticateToken, homeController.getHomePage);
router.post('/createEvents', authMiddleware.authenticateToken, homeController.createEvents);
router.post('/createSliders', authMiddleware.authenticateToken, homeController.createSliders);

module.exports = router;