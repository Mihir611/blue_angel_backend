const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.authenticateToken, homeController.getHomePage);
router.post('/createEvents', authMiddleware.authenticateToken, homeController.createEvents);
router.post('/createSliders', authMiddleware.authenticateToken, homeController.createSliders);
router.get('/Event',authMiddleware.authenticateToken, homeController.getEventById);
router.get('/Slider', authMiddleware.authenticateToken, homeController.getSliderById);
router.get('/FindEventSliders', authMiddleware.authenticateToken, homeController.getEventSliders);

module.exports = router;