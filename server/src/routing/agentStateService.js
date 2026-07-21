'use strict';

const redis = require('./redisClient');
const repos = require('../db/repositories');

const STATUS_KEY = (agentId) => `agent:status:${agentId}`;
const IDLE_ZSET_KEY = (productId) => `idle:product:${productId}`;

function assignedProductIds(agentId) {
    return repos.agentAssignments
        .find((a) => a.agent_id === agentId)
        .map((a) => a.product_id);
}

function assignedAgentIds(productId) {
    return repos.agentAssignments
        .find((a) => a.product_id === productId)
        .map((a) => a.agent_id);
}

/**
 * Set an agent's availability. Drives both the Redis idle-ranking used by
 * routing and the persisted agents.json record (source of truth on restart).
 * @param {string} agentId
 * @param {'available'|'break'|'offline'|'busy'} status
 */
async function setStatus(agentId, status) {
    await redis.set(STATUS_KEY(agentId), status);

    const productIds = assignedProductIds(agentId);
    const pipeline = redis.pipeline();

    if (status === 'available') {
        const now = Date.now();
        for (const productId of productIds) {
            pipeline.zadd(IDLE_ZSET_KEY(productId), now, agentId);
        }
        repos.agents.updateById(agentId, { status, last_idle_at: new Date(now).toISOString() });
    } else {
        for (const productId of productIds) {
            pipeline.zrem(IDLE_ZSET_KEY(productId), agentId);
        }
        repos.agents.updateById(agentId, { status });
    }

    await pipeline.exec();
}

async function getStatus(agentId) {
    const status = await redis.get(STATUS_KEY(agentId));
    if (status) return status;
    const agent = repos.agents.findById(agentId);
    return agent?.status || 'offline';
}

/**
 * Longest-Idle Routing: the agent assigned to this product who has been
 * available the longest (lowest last_idle_at score) wins. Falls back to
 * null if nobody assigned to the product is currently available.
 */
async function getLongestIdleAgent(productId) {
    const result = await redis.zrange(IDLE_ZSET_KEY(productId), 0, 0);
    return result[0] || null;
}

/** Pull an agent out of the idle pool the moment they're handed a call. */
async function markBusy(agentId) {
    await setStatus(agentId, 'busy');
}

module.exports = {
    setStatus,
    getStatus,
    getLongestIdleAgent,
    markBusy,
    assignedProductIds,
    assignedAgentIds,
};
