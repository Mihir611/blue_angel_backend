const bunyan = require('bunyan');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logger = bunyan.createLogger({
    name: 'blue_angel',
    streams: [
        {
            level: 'info',
            stream: process.stdout
        },
        {
            level: 'warn',
            path: path.join(logDir, 'warn.log'),
        },
        {
            level: 'error',
            path: path.join(logDir, 'error.log'),
        },
    ]
});

module.exports = logger;
