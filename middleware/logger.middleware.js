const logger = require('../utils/logger');

// Request logging middleware
const requestLogger = (req, res, next) => {
    logger.info({
        method: req.method,
        url: req.url,
        ip: req.ip,
        query: req.query,
        body: req.body,
    }, `Incoming request: ${req.method} ${req.url}`);
    next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const isOperational = statusCode < 500;

    if (isOperational) {
        logger.warn({
            method: req.method,
            url: req.url,
            statusCode,
            message: err.message,
        }, `Client error: ${statusCode} ${err.message}`);
    } else {
        logger.error({
            method: req.method,
            url: req.url,
            statusCode,
            message: err.message,
            stack: err.stack,        // full stack trace for server errors
            body: req.body,          // log request body to help debug
            query: req.query,
            ip: req.ip,
        }, `Server error: ${statusCode} ${err.message}`);
    }

    // Avoid sending response if headers already sent (e.g. streaming)
    if (res.headersSent) {
        return next(err);
    }

    res.status(statusCode).json({
        success: false,
        message: isOperational ? err.message : 'Internal Server Error',
        ...err(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}

module.exports = { requestLogger, errorLogger };