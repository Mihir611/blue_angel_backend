const express = require('express');
const router = express.Router();
const { RegisterEvent, getEventRegistrationByUser, getRegistrationByEvents, getRegistrationBySliders, getAllRegistrations, updateRegistrationStatus, deleteRegistrations } = require('../controllers/eventSliderRegistrationController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/eventRegister', authMiddleware.authenticateToken, RegisterEvent);
router.get('/user/:userEmail', authMiddleware.authenticateToken, getEventRegistrationByUser);
router.get('/event/:eventId', authMiddleware.authenticateToken, getRegistrationByEvents);
router.get('/slider/:sliderId', authMiddleware.authenticateToken, getRegistrationBySliders);
router.get('/active', authMiddleware.authenticateToken, getAllRegistrations);
router.patch('/:registrationId/status', authMiddleware.authenticateToken, updateRegistrationStatus);
router.delete('/:registrationId', authMiddleware.authenticateToken, deleteRegistrations);

module.exports = router;