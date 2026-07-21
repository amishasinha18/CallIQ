'use strict';

const { v4: uuidv4 } = require('uuid');
const repos = require('../db/repositories');
const agentState = require('../routing/agentStateService');
const livekit = require('./livekitService');
const presence = require('../sockets/presence');

/** Active (ringing/connected) call sessions, keyed by callId. Single-node in-memory store. */
const activeCalls = new Map();

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

/** No agent was available for this attempt — log it as missed and tell the customer to hold. */
async function logNoAgentAvailable({ callId, customerId, productId, productName }) {
    await repos.callLogs.insert({
        id: callId,
        customer_id: customerId,
        agent_id: null,
        product_id: productId,
        status: 'no_agent_available',
        started_at: new Date().toISOString(),
        answered_at: null,
        ended_at: new Date().toISOString(),
        duration_seconds: 0,
        recording_path: null,
        disposition_id: null,
        ended_by: 'system',
    });
    emitToCustomer(customerId, 'call:noAgentAvailable', { callId, productName });
    emitToAdmins('call:updated', {
        id: callId,
        customer_id: customerId,
        product_id: productId,
        product_name: productName,
        status: 'no_agent_available',
    });
}

/**
 * Try to hand a specific product's call to the longest-idle assigned agent.
 * If nobody is available, the customer hears hold music and the call ends —
 * there is no waiting room.
 */
async function routeCall({ customerId, customerName, productId }) {
    const product = await repos.products.findById(productId);
    if (!product) throw Object.assign(new Error('Unknown product'), { status: 404 });

    const agentId = await agentState.getLongestIdleAgent(productId);

    if (!agentId) {
        await logNoAgentAvailable({ callId: uuidv4(), customerId, productId, productName: product.name });
        return { routed: false };
    }

    return startRinging({ customerId, customerName, productId, product, agentId });
}

async function startRinging({ customerId, customerName, productId, product, agentId }) {
    const agent = await repos.agents.findById(agentId);
    // Pull the agent out of the idle pool immediately so nobody else gets routed to them.
    await agentState.markBusy(agentId);

    const callId = uuidv4();
    const session = {
        id: callId,
        customer_id: customerId,
        customer_name: customerName,
        agent_id: agentId,
        agent_name: agent.name,
        product_id: productId,
        product_name: product.name,
        status: 'ringing',
        direction: 'inbound',
        started_at: new Date().toISOString(),
        answered_at: null,
        ended_at: null,
        monitors: { listen: [], whisper: [], barge: [] },
        activeWhisperAdminId: null,
        activeBargeAdminId: null,
    };
    activeCalls.set(callId, session);

    emitToAgent(agentId, 'call:incoming', {
        callId,
        customerId,
        customerName,
        productId,
        productName: product.name,
    });
    emitToCustomer(customerId, 'call:ringing', { callId, productName: product.name });
    emitToAdmins('call:updated', publicSession(session));

    return { routed: true, session };
}

/** Agent-initiated callback (outdial) to a specific customer — bypasses routing entirely. */
async function startOutdial({ agentId, customerId, productId }) {
    const agent = await repos.agents.findById(agentId);
    const customer = await repos.customers.findById(customerId);
    const product = await repos.products.findById(productId);
    if (!agent || !customer || !product) {
        throw Object.assign(new Error('Agent, customer, or product not found'), { status: 404 });
    }

    await agentState.markBusy(agentId);

    const callId = uuidv4();
    const session = {
        id: callId,
        customer_id: customerId,
        customer_name: customer.name,
        agent_id: agentId,
        agent_name: agent.name,
        product_id: productId,
        product_name: product.name,
        status: 'ringing',
        direction: 'outbound',
        started_at: new Date().toISOString(),
        answered_at: null,
        ended_at: null,
        monitors: { listen: [], whisper: [], barge: [] },
        activeWhisperAdminId: null,
        activeBargeAdminId: null,
    };
    activeCalls.set(callId, session);

    emitToCustomer(customerId, 'call:incoming', {
        callId,
        agentId,
        agentName: agent.name,
        productId,
        productName: product.name,
        outbound: true,
    });
    emitToAgent(agentId, 'call:ringing', { callId, productName: product.name, customerName: customer.name });
    emitToAdmins('call:updated', publicSession(session));

    return session;
}

function publicSession(session) {
    const { monitors, ...rest } = session;
    return rest;
}

async function acceptCall(callId, role, userId) {
    const session = activeCalls.get(callId);
    const acceptorMatches =
        (session?.direction === 'inbound' && role === 'agent' && session.agent_id === userId) ||
        (session?.direction === 'outbound' && role === 'customer' && session.customer_id === userId);

    if (!session || !acceptorMatches || session.status !== 'ringing') {
        throw Object.assign(new Error('Call is not awaiting this participant'), { status: 409 });
    }

    session.status = 'connected';
    session.answered_at = new Date().toISOString();

    const customer = await repos.customers.findById(session.customer_id);
    const agent = await repos.agents.findById(session.agent_id);
    const [customerToken, agentToken, agentWhisperToken] = await Promise.all([
        livekit.customerToken(callId, customer),
        livekit.agentToken(callId, agent),
        livekit.agentWhisperToken(callId, agent),
    ]);

    const roomPayload = { callId, room: livekit.mainRoom(callId), livekitUrl: process.env.LIVEKIT_URL };
    emitToCustomer(session.customer_id, 'call:connected', { ...roomPayload, token: customerToken });
    emitToAgent(session.agent_id, 'call:connected', { ...roomPayload, token: agentToken });
    // Agent joins their whisper room silently, right away — nobody's there to hear yet.
    // Joining it now (rather than waiting for an admin to request whisper) means that
    // by the time an admin actually whispers, the agent is a long-established
    // participant instead of racing a simultaneous two-participant room join, which is
    // exactly the scenario that was silently dropping whisper audio (see livekitService.js).
    emitToAgent(session.agent_id, 'call:whisperStart', {
        callId,
        room: livekit.whisperRoom(callId),
        token: agentWhisperToken,
        livekitUrl: process.env.LIVEKIT_URL,
    });
    emitToAdmins('call:updated', publicSession(session));

    return session;
}

/**
 * The receiving party declined the ring. Inbound (agent declined): free the
 * agent up and try the next longest-idle agent, or tell the customer to hold
 * and hang up if nobody's left. Outbound (customer declined a callback):
 * just end it and free the agent.
 */
async function declineCall(callId, decliningRole, decliningUserId) {
    const session = activeCalls.get(callId);
    const declinerMatches =
        (session?.direction === 'inbound' && decliningRole === 'agent' && session.agent_id === decliningUserId) ||
        (session?.direction === 'outbound' && decliningRole === 'customer' && session.customer_id === decliningUserId);

    if (!session || !declinerMatches || session.status !== 'ringing') {
        throw Object.assign(new Error('Call is not awaiting this participant'), { status: 409 });
    }

    activeCalls.delete(callId);

    // Confirm back to the decliner so their own incoming-call modal actually clears.
    if (decliningRole === 'agent') emitToAgent(decliningUserId, 'call:declined', { callId });
    else emitToCustomer(decliningUserId, 'call:declined', { callId });

    emitToAdmins('call:updated', { ...publicSession(session), status: 'ended' });

    if (session.direction === 'outbound') {
        // Customer declined the agent's callback — just log it, nothing to reroute.
        await agentState.setStatus(session.agent_id, 'available');
        await repos.callLogs.insert({
            id: callId,
            customer_id: session.customer_id,
            agent_id: session.agent_id,
            product_id: session.product_id,
            status: 'declined',
            started_at: session.started_at,
            answered_at: null,
            ended_at: new Date().toISOString(),
            duration_seconds: 0,
            recording_path: null,
            disposition_id: null,
            ended_by: 'customer',
        });
        emitToAgent(session.agent_id, 'call:ended', { callId, endedBy: 'customer' });
        return;
    }

    // Look for a replacement BEFORE freeing the decliner — otherwise, on a product with
    // only one assigned agent, they'd immediately be re-routed to their own declined call.
    const nextAgentId = await agentState.getLongestIdleAgent(session.product_id);
    const product = await repos.products.findById(session.product_id);
    await agentState.setStatus(session.agent_id, 'available');

    if (nextAgentId) {
        await startRinging({
            customerId: session.customer_id,
            customerName: session.customer_name,
            productId: session.product_id,
            product,
            agentId: nextAgentId,
        });
    } else {
        await logNoAgentAvailable({
            callId,
            customerId: session.customer_id,
            productId: session.product_id,
            productName: product.name,
        });
    }
}

async function endCall(callId, endedBy) {
    const session = activeCalls.get(callId);
    if (!session) throw Object.assign(new Error('Call not found'), { status: 404 });

    session.status = 'ended';
    session.ended_at = new Date().toISOString();
    const durationSeconds = Math.round(
        (new Date(session.ended_at) - new Date(session.answered_at || session.started_at)) / 1000
    );

    const callLog = await repos.callLogs.insert({
        id: callId,
        customer_id: session.customer_id,
        agent_id: session.agent_id,
        product_id: session.product_id,
        status: session.answered_at ? 'completed' : 'missed',
        started_at: session.started_at,
        answered_at: session.answered_at,
        ended_at: session.ended_at,
        duration_seconds: session.answered_at ? durationSeconds : 0,
        recording_path: null,
        disposition_id: null,
        ended_by: endedBy,
    });

    await livekit.teardownRooms(callId);
    activeCalls.delete(callId);

    emitToCustomer(session.customer_id, 'call:ended', { callId, endedBy });
    emitToAgent(session.agent_id, 'call:ended', { callId, endedBy });
    emitToAdmins('call:updated', { ...publicSession(session), status: 'ended' });

    await agentState.setStatus(session.agent_id, 'available');

    return callLog;
}

async function startMonitor(callId, admin, mode) {
    const session = activeCalls.get(callId);
    if (!session || session.status !== 'connected') {
        throw Object.assign(new Error('Call is not active'), { status: 409 });
    }

    if (mode === 'listen') {
        session.monitors.listen.push(admin.id);
        const token = await livekit.adminListenToken(callId, admin);
        return { room: livekit.mainRoom(callId), token, livekitUrl: process.env.LIVEKIT_URL };
    }

    if (mode === 'barge') {
        session.monitors.barge.push(admin.id);
        session.activeBargeAdminId = admin.id;
        const token = await livekit.adminBargeToken(callId, admin);
        emitToCustomer(session.customer_id, 'call:supervisorJoined', { callId });
        emitToAgent(session.agent_id, 'call:supervisorJoined', { callId });
        return { room: livekit.mainRoom(callId), token, livekitUrl: process.env.LIVEKIT_URL };
    }

    if (mode === 'whisper') {
        // Flip the agent's whisper-room publish permission on BEFORE telling anyone —
        // if this throws (LiveKit unreachable, etc.) nothing about the call/hold state
        // should change, and the admin sees the error via their existing catch handler.
        await livekit.setAgentWhisperPublish(callId, `agent:${session.agent_id}:whisper`, true);

        session.monitors.whisper.push(admin.id);
        session.activeWhisperAdminId = admin.id;

        // The agent already joined this room silently when the call connected
        // (see acceptCall) — they're a stable, long-established participant by now,
        // so the admin joining is just the standard "existing participant sees a
        // new one arrive" path rather than a risky simultaneous two-party join.
        const adminToken = await livekit.adminWhisperToken(callId, admin);

        // Agent first (they need to be unmuted before the conversation starts),
        // then the customer (being silenced a beat later costs nothing).
        emitToAgent(session.agent_id, 'call:whisperActive', { callId, active: true });
        emitToCustomer(session.customer_id, 'call:holdStart', { callId });

        return { room: livekit.whisperRoom(callId), token: adminToken, livekitUrl: process.env.LIVEKIT_URL };
    }

    throw Object.assign(new Error('Unknown monitor mode'), { status: 400 });
}

/** Reverse of startMonitor's whisper/barge branches — puts the call visuals back to normal. */
async function stopMonitor(callId, admin, mode) {
    const session = activeCalls.get(callId);
    if (!session || session.status !== 'connected') {
        throw Object.assign(new Error('Call is not active'), { status: 409 });
    }

    if (mode === 'whisper') {
        // Stale/duplicate stop (e.g. a second admin's modal, or a late retry) — ignore.
        if (session.activeWhisperAdminId !== admin.id) return { ok: true };

        session.activeWhisperAdminId = null;
        await livekit.setAgentWhisperPublish(callId, `agent:${session.agent_id}:whisper`, false);
        emitToAgent(session.agent_id, 'call:whisperActive', { callId, active: false });
        emitToCustomer(session.customer_id, 'call:holdEnd', { callId });
    }

    if (mode === 'barge') {
        // Same staleness guard — ignore a stop that doesn't match the admin who's actually in.
        if (session.activeBargeAdminId !== admin.id) return { ok: true };

        session.activeBargeAdminId = null;
        // Without this, "A supervisor has joined this call" stays up on both sides forever —
        // there was previously no signal at all telling either party the admin had left.
        emitToCustomer(session.customer_id, 'call:supervisorLeft', { callId });
        emitToAgent(session.agent_id, 'call:supervisorLeft', { callId });
    }

    // listen: no server-side state to unwind — it never touched customer/agent state,
    // closing the modal already fully disconnects the admin's own room connection.
    return { ok: true };
}

function getLiveCalls() {
    return Array.from(activeCalls.values()).map(publicSession);
}

function getCall(callId) {
    return activeCalls.get(callId) || null;
}

module.exports = {
    init,
    routeCall,
    startOutdial,
    acceptCall,
    declineCall,
    endCall,
    startMonitor,
    stopMonitor,
    getLiveCalls,
    getCall,
};
