// start.js
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const env = (process.env.ENV || process.env.NODE_ENV || '').toLowerCase().trim();

const isLocal = env === 'localhost' || env === 'local' || env === 'development';

const serverFile = isLocal ? 'localServer.js' : 'server.js';

if (!fs.existsSync(path.join(__dirname, serverFile))) {
    console.error(`Error: Server file not found: ${serverFile}`);
    process.exit(1);
}

console.log(`Starting server → ${serverFile} (ENV=${env || 'default'})`);
require(`./${serverFile}`);