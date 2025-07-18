require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const homeRoutes = require('./routes/homeRoutes');
const itineraryRoutes = require('./routes/itineraryRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const webhookController = require('./controllers/webhookController');
const registerEventSlidersRoutes = require('./routes/eventsSliderRegistrationRoutes');
const helmet = require('helmet');

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom app property
app.notifyUser = webhookController.sendUserNotification;

// Routes
app.use('/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/registrationEventSliders', registerEventSlidersRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// For local development only
if (process.env.NODE_ENV !== 'production') {
    const os = require('os');

    // Get network interfaces to find IP address
    const getLocalIP = () => {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const interface of interfaces[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (interface.family === 'IPv4' && !interface.internal) {
                    return interface.address;
                }
            }
        }
        return 'localhost';
    };

    const PORT = process.env.PORT || 3000;
    const HOST = '0.0.0.0';

    app.listen(PORT, HOST, () => {
        const localIP = getLocalIP();
        const hostname = os.hostname();
        console.log(`🚀 Server running successfully!`);
        console.log(`📍 Host: ${hostname}`);
        console.log(`🌐 Local access: http://localhost:${PORT}`);
        console.log(`📱 Network access: http://${localIP}:${PORT}`);
        console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

// Export for Vercel
module.exports = app;