'use strict';

const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');

// This app only uses Supabase Storage, but createClient() always constructs the
// full client, including a Realtime websocket client — which needs the `ws`
// package explicitly on Node < 22 (no native WebSocket support), or client
// construction itself throws.
const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    realtime: { transport: ws },
});

module.exports = {
    supabase,
    recordingsBucket: supabase.storage.from(env.supabaseRecordingsBucket),
    productImagesBucket: supabase.storage.from(env.supabaseProductImagesBucket),
};
