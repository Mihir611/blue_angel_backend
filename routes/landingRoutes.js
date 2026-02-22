const express = require('express');
const router = express.Router();
const landingController = require('../controllers/landingController');

router.get('/landingEvents', landingController.getLandingPageEvents);
// router.get('itineraries');

module.exports = router;