'use strict';

const Redis = require('ioredis');
const env = require('../config/env');

const redis = new Redis(env.redisUrl, { lazyConnect: false });

redis.on('error', (err) => console.error('[Redis] error:', err.message));
redis.on('connect', () => console.log('[Redis] connected'));

module.exports = redis;
