'use strict';

require('dotenv').config();

module.exports = {
    // 4100 to match everything that talks to it: server/.env.example, the web app's
    // NEXT_PUBLIC_API_URL, the README and docs/DEVELOPMENT.md. With 4000 here, a server
    // started without PORT in its .env listened where nothing was looking for it.
    port: process.env.PORT || 4100,

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

    databaseUrl: process.env.DATABASE_URL,

    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseRecordingsBucket: process.env.SUPABASE_RECORDINGS_BUCKET || 'recordings',
    supabaseProductImagesBucket: process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || 'product-images',
};
