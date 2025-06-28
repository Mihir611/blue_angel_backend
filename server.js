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
const helmet = require('helmet');
const os = require('os');

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.notifyUser = webhookController.sendUserNotification;

app.use('/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/webhook', webhookRoutes);


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

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // This allows connections from any IP address

app.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    const hostname = os.hostname();
    
    console.log(`🚀 Server running successfully!`);
    console.log(`📍 Host: ${hostname}`);
    console.log(`🌐 Local access: http://localhost:${PORT}`);
    console.log(`📱 Network access: http://${localIP}:${PORT}`);
    console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
});