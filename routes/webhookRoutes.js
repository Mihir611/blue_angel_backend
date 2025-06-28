const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.post('/subscribe', webhookController.subscribe);
router.delete('/unsubscribe/:subscriptionId', webhookController.unsubscribe);

// Notification routes
router.post('/notify/:subscriptionId', webhookController.notifySubscription);
router.post('/notify-user/:userId', webhookController.notifyUser);

// Subscription information routes
router.get('/subscriptions/:subscriptionId', webhookController.getSubscription);
router.get('/user/:user/subscriptions', webhookController.getUserSubscriptions);

// Health check route
router.get('/health', webhookController.healthCheck);

module.exports = router;