const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { time, timeStamp } = require('console');
const { resolve } = require('path');
const { hostname, type } = require('os');
const path = require('path');
const { subscribe } = require('diagnostics_channel');
const { title } = require('process');

const webhookSubscription = new Map();

const generateUniqueId = () => {
    return crypto.randomUUID();
};

const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
};

const makeHttpRequest = (url, data, payload) => {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const postData = JSON.stringify(data);

        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'WebhookClient/1.0',
                'X-Webhook-Source': 'travel-app-server',
                ...options.headers
            },
            timeout: options.timeout || 10000  
        };

        const req = httpModule.request(requestOptions, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    statusMessage: res.statusMessage,
                    headers: res.headers,
                    data: responseData
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

const sendWebhookNotifications = async (subscriptionId, payload) => {
    if(!webhookSubscription.has(subscriptionId)) {
        throw new Error('Subscription not found');
    }

    const subscription = webhookSubscription.get(subscriptionId);

    if(!subscription.isActive) {
        throw new Error('Subscription is not active');
    }

    const webhookPayload = {
        subscriptionId,
        timeStamp: new Date().toISOString(),
        ...payload
    };

    try {
        const response = await makeHttpRequest(subscription.webhookUrl, webhookPayload, {
            timeout: 10000
        });

        subscription.lastNotificationSent = webhookPayload.timestamp;
        subscription.totalNotificationsSent = (subscription.totalNotificationsSent || 0) + 1;
        webhookSubscription.set(subscriptionId, subscription);

        return {
            success: true,
            status: response.status,
            sentAt: webhookPayload.timeStamp,
        };
    } catch (error) {
        onsole.error(`Webhook notification failed for ${subscriptionId}:`, error.message);
        
        // Deactivate subscription if webhook consistently fails
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message.includes('timeout')) {
            subscription.isActive = false;
            subscription.lastError = error.message;
            subscription.lastErrorAt = new Date().toISOString();
            webhookSubscriptions.set(subscriptionId, subscription);
        }

        throw error;
    }
}

const webhookController = {
    subscribe: (req, res) => {
        try {
            const { webhookUrl, deviceId, appVersion, notificatoinType } = req.body;

            if(!webhookUrl || !isValidUrl(webhookUrl)) {
                return res.status(400).json({ success: false, error: 'Invalid webhook URL' });
            }

            if(!userId) {
                return res.status(400).json({ success: false, error: 'User ID is required' });
            }

            const subscriptionId = generateUniqueId();
            const subscription = {
                id: subscriptionId,
                userId,
                webhookUrl,
                deviceId: deviceId || 'unknown',
                appVersion: appVersion || '1.0.0',
                notificationTypes: notificationTypes || ['all'], // e.g., ['itinerary', 'profile', 'auth']
                subscribedAt: new Date().toISOString(),
                lastNotificationSent: null,
                totalNotificationsSent: 0,
                isActive: true
            };

            webhookSubscription.set(subscriptionId, subscription);

            req.status(201).json({
                success: true,
                subscriptionId,
                message: 'Successfully subscribed to webhook notifications',
                subscription: {
                    id: subscriptionId,
                    userId,
                    subscribedAt: subscription.subscribedAt,
                    notificatoinType: subscription.notificationTypes,
                }
            });

            console.log(`📱 New webhook subscription: ${subscriptionId} for user: ${userId}`);
        } catch (error) {
            console.error('Error in webhook subscribe:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    },

    unsubscribe: (req, res) => {
        try {
            const { subscriptionId } = req.params;

            if (!webhookSubscriptions.has(subscriptionId)) {
                return res.status(404).json({
                    success: false,
                    error: 'Subscription not found'
                });
            }

            const subscription = webhookSubscriptions.get(subscriptionId);
            webhookSubscriptions.delete(subscriptionId);

            res.json({
                success: true,
                message: 'Successfully unsubscribed from webhook notifications',
                subscriptionId
            });

            console.log(`📱 Webhook subscription removed: ${subscriptionId}`);
        } catch (error) {
            console.error('Error in webhook unsubscribe:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    },

    notifySubscription: async (req, res) => {
        try {
            const { subscriptionId } = req.params;
            const { type, title, message, data } = req.body;

            const result = await sendWebhookNotifications(subscriptionId, {
                type: type || 'general',
                title: title || 'Notification',
                message: message || 'You have a new update',
                data: data || {}
            });

            res.json({
                success: true,
                message: 'Notification sent successfully',
                subscriptionId,
                ...result
            });

        } catch (error) {
            console.error('Error in notifySubscription:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send notification',
                details: error.message,
                subscriptionId: req.params.subscriptionId
            });
        }
    },

    notifyUser: async (req, res) => {
        try {
            const { userId } = req.params;
            const { type, title, message, data } = req.body;

            const userSubscriptions = Array.from(webhookSubscription.values()).filter(sub => sub.userId === userId && sub.isActive);
            if (userSubscriptions.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No active subscriptions found for user'
                });
            }

            const payload = {
                type: type || 'general',
                title: title || 'Notification',
                message: message || 'You have a new update',
                data: data || {}
            };

            const results = [];

            for(const subscription of userSubscriptions) {
                if(!subscription.notificationTypes.includes('all') && !subscription.notificationTypes.includes(type)) {
                    continue; // Skip if the type is not included in the subscription
                }
                try {
                    const result = await sendWebhookNotifications(subscription.id, payload);
                    results.push({
                        subscriptionId: subscription.id,
                        deviceId: subscription.deviceId,
                        success: true,
                        ...result
                    });
                } catch (error) {
                    results.push({
                        subscriptionId: subscription.id,
                        deviceId: subscription.deviceId,
                        success: false,
                        error: error.message
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;

            res.json({
                success: true,
                message: `Notifications sent to ${successCount} out of ${userSubscriptions.length} subscriptions`,
                userId,
                totalDevices: userSubscriptions.length,
                successfulSends: successCount,
                failedSends: results.length - successCount,
                results
            });

            console.log(`📱 Broadcast sent to ${successCount}/${results.length} devices for user: ${userId}`);
        } catch(error) {
            console.error('Error in notifyUser:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    },

    getSubscription: (req, res) => {
        try {
            const { subscriptionId } = req.params;

            if (!webhookSubscriptions.has(subscriptionId)) {
                return res.status(404).json({
                    success: false,
                    error: 'Subscription not found'
                });
            }

            const subscription = webhookSubscriptions.get(subscriptionId);

            res.json({
                success: true,
                subscription: {
                    id: subscription.id,
                    userId: subscription.userId,
                    deviceId: subscription.deviceId,
                    appVersion: subscription.appVersion,
                    notificationTypes: subscription.notificationTypes,
                    subscribedAt: subscription.subscribedAt,
                    lastNotificationSent: subscription.lastNotificationSent,
                    totalNotificationsSent: subscription.totalNotificationsSent,
                    isActive: subscription.isActive
                }
            });
        } catch (error) {
            console.error('Error in getSubscription:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    },

    getUserSubscriptions: (req, res) => {
        try {
            const { userId } = req.params;
            const { active } = req.query;

            let userSubs = Array.from(webhookSubscriptions.values())
                .filter(sub => sub.userId === userId);

            if (active !== undefined) {
                const isActive = active === 'true';
                userSubs = userSubs.filter(sub => sub.isActive === isActive);
            }

            res.json({
                success: true,
                userId,
                totalSubscriptions: userSubs.length,
                subscriptions: userSubs.map(sub => ({
                    id: sub.id,
                    deviceId: sub.deviceId,
                    appVersion: sub.appVersion,
                    notificationTypes: sub.notificationTypes,
                    subscribedAt: sub.subscribedAt,
                    lastNotificationSent: sub.lastNotificationSent,
                    totalNotificationsSent: sub.totalNotificationsSent,
                    isActive: sub.isActive
                }))
            });
        } catch (error) {
            console.error('Error in getUserSubscriptions:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    },

    healthCheck: (req, res) => {
        try {
            const totalSubs = webhookSubscriptions.size;
            const activeSubs = Array.from(webhookSubscriptions.values())
                .filter(sub => sub.isActive).length;

            res.json({
                success: true,
                status: 'healthy',
                timestamp: new Date().toISOString(),
                totalSubscriptions: totalSubs,
                activeSubscriptions: activeSubs,
                inactiveSubscriptions: totalSubs - activeSubs
            });
        } catch (error) {
            console.error('Error in healthCheck:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    },

    sendUserNotification: async (userId, type, title, message, data = {}) => {
        try {
            const userSubscriptions = Array.from(webhookSubscriptions.vallues()).filter(sub => sub.userId === userId && sub.isActive);

            const results = [];
            for(const subscription of userSubscriptions) {
                if(!subscription.notificationTypes.includes('all') && !subscription.notificationTypes.includes(type)) {
                    continue; // Skip if the type is not included in the subscription
                }
                try {
                    const result = await sendWebhookNotifications(subscription.id, {
                        type,
                        title,
                        message,
                        data
                    });

                    results.push({
                        subscriptionId: subscription.id,
                        deviceId: subscription.deviceId,
                        success: true,
                    });

                } catch (error) {
                    results.push({
                        subscriptionId: subscription.id,
                        deviceId: subscription.deviceId,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                totalNotifications: results.length,
                successfulSends: results.filter(r => r.success).length,
                results
            };
        } catch (error) {
            console.error('Error sending user notification:', error);
            return {
                success: false,
                error: error.message,
                results: []
            };
        }
    }
};

module.exports = webhookController;