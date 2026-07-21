'use strict';

const { v4: uuidv4 } = require('uuid');
const repos = require('../db/repositories');
const agentState = require('../routing/agentStateService');
const redis = require('../routing/redisClient');
const presence = require('../sockets/presence');

let io = null;
function init(ioInstance) {
    io = ioInstance;
}

function emitToAgent(agentId, event, payload) {
    const socketId = presence.getSocketId('agent', agentId);
    if (socketId) io.to(socketId).emit(event, payload);
}

function emitToCustomer(customerId, event, payload) {
    const socketId = presence.getSocketId('customer', customerId);
    if (socketId) io.to(socketId).emit(event, payload);
}

function emitToAdmins(event, payload) {
    io.to('role:admin').emit(event, payload);
}

/**
 * "Online" for chat purposes reuses the same available/break/offline/busy
 * status calls use — there is one presence model per agent, not a separate
 * one per channel. An agent mid-call (status 'busy') will not show up as
 * chat-eligible either. Revisit if chat should be independent of voice load.
 */
async function isAgentOnline(agentId) {
    const status = await agentState.getStatus(agentId);
    return status === 'available';
}

async function onlineAgentIdsForProduct(productId) {
    const assigned = await agentState.assignedAgentIds(productId);
    const flags = await Promise.all(assigned.map((id) => isAgentOnline(id)));
    return assigned.filter((_, i) => flags[i]);
}

/** Visibility Check — used by the customer product grid to show/hide the Text button. */
async function availabilityByProduct() {
    const products = await repos.products.all();
    const result = {};
    await Promise.all(
        products.map(async (p) => {
            result[p.id] = (await onlineAgentIdsForProduct(p.id)).length;
        })
    );
    return result;
}

function publicChat(chat) {
    return chat;
}

/** Customer initiates a chat — created PENDING, ring-all broadcast to every online agent on this product. */
async function initiateChat({ customerId, customerName, productId }) {
    const product = await repos.products.findById(productId);
    if (!product) throw Object.assign(new Error('Unknown product'), { status: 404 });

    const onlineAgentIds = await onlineAgentIdsForProduct(productId);
    if (onlineAgentIds.length === 0) {
        throw Object.assign(new Error('No agents online for this product'), { status: 409 });
    }

    const chat = await repos.chats.insert({
        id: `chat-${uuidv4()}`,
        customer_id: customerId,
        customer_name: customerName,
        product_id: productId,
        product_name: product.name,
        status: 'PENDING',
        agent_id: null,
        transfer_history: [],
        created_at: new Date().toISOString(),
        assigned_at: null,
        closed_at: null,
    });

    const payload = {
        chatId: chat.id,
        customerId,
        customerName,
        productId,
        productName: product.name,
    };
    onlineAgentIds.forEach((agentId) => emitToAgent(agentId, 'chat:request', payload));
    // Confirm back to the requester too — otherwise their own widget has nothing to show
    // until someone accepts, and a PENDING chat with no visible waiting state feels broken.
    emitToCustomer(customerId, 'chat:pending', payload);
    emitToAdmins('chat:updated', publicChat(chat));

    return chat;
}

/** Customer withdraws a still-PENDING request before anyone accepts it. */
async function cancelChat(chatId, customerId) {
    const chat = await repos.chats.findById(chatId);
    if (!chat || chat.customer_id !== customerId) {
        throw Object.assign(new Error('Chat not found'), { status: 404 });
    }
    if (chat.status !== 'PENDING') {
        throw Object.assign(new Error('Chat is no longer pending'), { status: 409 });
    }

    const updated = await repos.chats.updateById(chatId, { status: 'CLOSED', closed_at: new Date().toISOString() });

    const onlineAgentIds = await onlineAgentIdsForProduct(chat.product_id);
    onlineAgentIds.forEach((id) => emitToAgent(id, 'chat:claimed', { chatId }));
    emitToAdmins('chat:updated', publicChat(updated));

    return updated;
}

/**
 * First-to-accept wins. A short Redis lock (SET NX) makes the claim atomic
 * even across multiple backend instances — useful belt-and-suspenders here
 * since a single Node process is already inherently serial.
 */
async function acceptChat(chatId, agentId, agentName) {
    const lockKey = `chat:lock:${chatId}`;
    const acquired = await redis.set(lockKey, agentId, 'EX', 30, 'NX');
    if (!acquired) {
        throw Object.assign(new Error('Already claimed'), { status: 409 });
    }

    const chat = await repos.chats.findById(chatId);
    if (!chat || chat.status !== 'PENDING') {
        throw Object.assign(new Error('Already claimed'), { status: 409 });
    }

    const updated = await repos.chats.updateById(chatId, {
        status: 'ASSIGNED',
        agent_id: agentId,
        assigned_at: new Date().toISOString(),
    });

    // Retraction — every other online agent on this product drops it from their pending queue.
    const onlineAgentIds = await onlineAgentIdsForProduct(chat.product_id);
    onlineAgentIds
        .filter((id) => id !== agentId)
        .forEach((id) => emitToAgent(id, 'chat:claimed', { chatId }));

    emitToCustomer(chat.customer_id, 'chat:accepted', { chatId, agentName });
    emitToAdmins('chat:updated', publicChat(updated));

    return updated;
}

function assertParticipant(chat, role, userId) {
    if (role === 'agent' && chat.agent_id === userId) return;
    if (role === 'customer' && chat.customer_id === userId) return;
    throw Object.assign(new Error('Not a participant in this chat'), { status: 403 });
}

async function sendMessage(chatId, role, userId, senderName, text) {
    const chat = await repos.chats.findById(chatId);
    if (!chat || !['ASSIGNED', 'ACTIVE'].includes(chat.status)) {
        throw Object.assign(new Error('Chat is not open'), { status: 409 });
    }
    assertParticipant(chat, role, userId);

    if (chat.status === 'ASSIGNED') {
        await repos.chats.updateById(chatId, { status: 'ACTIVE' });
    }

    const message = await repos.chatMessages.insert({
        id: `msg-${uuidv4()}`,
        chat_id: chatId,
        sender_role: role,
        sender_id: userId,
        sender_name: senderName,
        text,
        created_at: new Date().toISOString(),
    });

    emitToAgent(chat.agent_id, 'chat:message', message);
    emitToCustomer(chat.customer_id, 'chat:message', message);
    return message;
}

async function closeChat(chatId, role, userId) {
    const chat = await repos.chats.findById(chatId);
    if (!chat || chat.status === 'CLOSED') {
        throw Object.assign(new Error('Chat not found or already closed'), { status: 404 });
    }
    if (role !== 'admin') assertParticipant(chat, role, userId);

    const updated = await repos.chats.updateById(chatId, { status: 'CLOSED', closed_at: new Date().toISOString() });

    emitToAgent(chat.agent_id, 'chat:closed', { chatId, closedBy: role });
    emitToCustomer(chat.customer_id, 'chat:closed', { chatId, closedBy: role });
    emitToAdmins('chat:updated', publicChat(updated));
    return updated;
}

/** Only agents assigned to the exact same product, currently online, excluding the current agent. */
async function transferCandidates(chatId, currentAgentId) {
    const chat = await repos.chats.findById(chatId);
    if (!chat) throw Object.assign(new Error('Chat not found'), { status: 404 });

    const onlineAgentIds = await onlineAgentIdsForProduct(chat.product_id);
    const candidateIds = onlineAgentIds.filter((id) => id !== currentAgentId);
    const candidates = await Promise.all(candidateIds.map((id) => repos.agents.findById(id)));
    return candidates.filter(Boolean).map(({ password, ...rest }) => rest);
}

async function transferChat(chatId, fromAgentId, toAgentId) {
    const chat = await repos.chats.findById(chatId);
    if (!chat || chat.agent_id !== fromAgentId) {
        throw Object.assign(new Error('You do not own this chat'), { status: 403 });
    }

    const candidates = await transferCandidates(chatId, fromAgentId);
    if (!candidates.some((a) => a.id === toAgentId)) {
        throw Object.assign(new Error('Agent is not eligible for transfer (must be online and assigned to this product)'), {
            status: 400,
        });
    }

    const toAgent = await repos.agents.findById(toAgentId);
    const updated = await repos.chats.updateById(chatId, {
        agent_id: toAgentId,
        transfer_history: [
            ...chat.transfer_history,
            { from: fromAgentId, to: toAgentId, at: new Date().toISOString() },
        ],
    });

    emitToAgent(fromAgentId, 'chat:transferredAway', { chatId });
    emitToAgent(toAgentId, 'chat:transferredTo', publicChat(updated));
    emitToCustomer(chat.customer_id, 'chat:agentChanged', { chatId, agentName: toAgent.name });
    emitToAdmins('chat:updated', publicChat(updated));

    return updated;
}

async function getChat(chatId) {
    return repos.chats.findById(chatId);
}

module.exports = {
    init,
    availabilityByProduct,
    onlineAgentIdsForProduct,
    initiateChat,
    cancelChat,
    acceptChat,
    sendMessage,
    closeChat,
    transferCandidates,
    transferChat,
    getChat,
};
