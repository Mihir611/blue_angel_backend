const mongoose = require('mongoose');
const os = require('os');
const connectDB = require('../config/db');

exports.healthCheck = async (req, res) => {
    const start = Date.now();

    try {
        await connectDB();
        const dbState = mongoose.connection.readyState;
        const dbStatusMap = {
            0: "disconnected",
            1: "connected",
            2: "connecting",
            3: "disconnecting"
        }

        const latency = Date.now() - start;

        res.status(200).json({
            status: "ok", environment: 'vercel', database: dbStatusMap[dbState], server: {
                platform: os.platform(), node: process.version
            }, performance: { latency: `${latency} ms`, uptime: process.uptime() }, timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message })
    }
}