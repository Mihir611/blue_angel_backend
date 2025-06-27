const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/itineraryController');
const authMiddleware = require('../middleware/authMiddleware');

// Generate new itinerary request
router.post('/generateItinerary', authMiddleware.authenticateToken, itineraryController.generateItinerary);

// Get user's itineraries (using query parameter for email)
router.get('/getItinerary', authMiddleware.authenticateToken, itineraryController.getItinerary);

// Get all itineraries (admin route)
router.get('/getAllItineraries', authMiddleware.authenticateToken, itineraryController.getAllItineraries);

// Get status of a specific itinerary request
router.get('/status/:requestId', authMiddleware.authenticateToken, itineraryController.getItineraryStatus);

// Generate additional itinerary for existing request
router.post('/generateAdditional/:requestId', authMiddleware.authenticateToken, itineraryController.generateAdditionalItinerary);

// Get specific itinerary response details
router.get('/response/:responseId', authMiddleware.authenticateToken, itineraryController.getSpecificItinerary);

module.exports = router;
