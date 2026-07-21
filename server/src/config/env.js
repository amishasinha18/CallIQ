'use strict';

require('dotenv').config();
const path = require('path');

module.exports = {
    port: process.env.PORT || 4000,

    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

    livekitUrl: process.env.LIVEKIT_URL,
    livekitHttpUrl: process.env.LIVEKIT_HTTP_URL,
    livekitApiKey: process.env.LIVEKIT_API_KEY,
    livekitApiSecret: process.env.LIVEKIT_API_SECRET,

    corsOrigin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
        : '*',

    dbDir: path.join(__dirname, '..', '..', '..', 'db'),
    recordingsDir: path.join(__dirname, '..', '..', '..', 'recordings'),
};
