require('dotenv').config();
const express = require('express');
const app = express();
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const homeRoutes = require('./routes/homeRoutes');
const itineraryRoutes = require('./routes/tripRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const webhookController = require('./controllers/webhookController');
const registerEventSlidersRoutes = require('./routes/eventsSliderRegistrationRoutes');
const bikeRoutes = require('./routes/bikeRoutes');
const weatherRoutes = require('./routes/weatherConditionRoutes');
const landingRoutes = require('./routes/landingRoutes');
const fuelPriceRoutes = require('./routes/fuelRoutes');
const utilityRoutes = require('./routes/utilityRoutes');

const helmet = require('helmet');
const cors = require('cors');


// ====================
// MIDDLEWARE
// ====================

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).send(err.message || "Internal Server Error");
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: [
        'http://localhost:5000',
        /\.vercel\.app$/  // Better wildcard support
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// ====================
// DATABASE CONNECTION
// ====================

// For Vercel (serverless)
if (process.env.NODE_ENV === 'production') {
    let dbReady = false;

    app.use(async (req, res, next) => {
        if (!dbReady) {
            await connectDB();
            dbReady = true;
        }
        next();
    });
}

// ====================
// CUSTOM APP PROPERTY
// ====================

app.notifyUser = webhookController.sendUserNotification;


// ====================
// ROUTES
// ====================

app.use('/api/user', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/registrationEventSliders', registerEventSlidersRoutes);
app.use('/api/bike', bikeRoutes);
app.use('/api/landing', landingRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/fuel', fuelPriceRoutes);
app.use('/api/utility', utilityRoutes);

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'API is running!',
        timestamp: new Date().toISOString()
    });
});


// ====================
// ERROR HANDLING
// ====================

app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});


// ====================
// LOCAL DEVELOPMENT SERVER
// ====================

if (process.env.NODE_ENV !== 'production') {

    const PORT = process.env.PORT || 3000;

    // 🔥 Connect DB once before starting server
    connectDB()
        .then(() => {
            app.listen(PORT, () => {
                console.log(`🚀 Server running locally on http://localhost:${PORT}`);
            });
        })
        .catch((err) => {
            console.error("DB connection failed:", err);
            process.exit(1);
        });
}


// ====================
// EXPORT FOR VERCEL
// ====================

module.exports = app;