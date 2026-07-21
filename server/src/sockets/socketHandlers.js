'use strict';

const authService = require('../auth/authService');
const presence = require('./presence');
const callService = require('../calls/callService');
const chatService = require('../chats/chatService');
const agentState = require('../routing/agentStateService');
const emitter = require('./emitter');

function registerSocketHandlers(io) {
    callService.init(io);
    chatService.init(io);
    emitter.init(io);

    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            socket.user = authService.verifyToken(token);
            next();
        } catch {
            next(new Error('unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        const { sub, role, name } = socket.user;
        presence.register(role, sub, socket.id);
        if (role === 'admin') socket.join('role:admin');
        console.log(`[Socket] ${role}:${sub} (${name}) connected`);

        // Customer clicks "Talk to an Agent" on a product card.
        socket.on('call:request', async ({ productId }) => {
            try {
                await callService.routeCall({ customerId: sub, customerName: name, productId });
            } catch (err) {
                socket.emit('call:error', { message: err.message });
            }
        });

        // Agent accepts an inbound ring, or customer accepts an outdial ring.
        socket.on('call:accept', async ({ callId }) => {
            try {
                await callService.acceptCall(callId, role, sub);
            } catch (err) {
                socket.emit('call:error', { message: err.message });
            }
        });

        // Whoever receives the ring declines it — reroute (inbound) or just end it (outbound).
        socket.on('call:reject', async ({ callId }) => {
            try {
                await callService.declineCall(callId, role, sub);
            } catch (err) {
                socket.emit('call:error', { message: err.message });
            }
        });

        socket.on('call:hangup', async ({ callId }) => {
            try {
                await callService.endCall(callId, role);
            } catch (err) {
                socket.emit('call:error', { message: err.message });
            }
        });

        // Customer initiates a text chat — ring-all to every online agent on this product.
        socket.on('chat:request', async ({ productId }) => {
            try {
                await chatService.initiateChat({ customerId: sub, customerName: name, productId });
            } catch (err) {
                socket.emit('chat:error', { message: err.message });
            }
        });

        // First agent to accept wins; everyone else gets a chat:claimed retraction.
        socket.on('chat:accept', async ({ chatId }) => {
            try {
                await chatService.acceptChat(chatId, sub, name);
            } catch (err) {
                socket.emit('chat:error', { chatId, message: err.message });
            }
        });

        socket.on('chat:message', async ({ chatId, text }) => {
            try {
                await chatService.sendMessage(chatId, role, sub, name, text);
            } catch (err) {
                socket.emit('chat:error', { chatId, message: err.message });
            }
        });

        // Customer withdraws a still-pending request before any agent accepts.
        socket.on('chat:cancel', async ({ chatId }) => {
            try {
                await chatService.cancelChat(chatId, sub);
            } catch (err) {
                socket.emit('chat:error', { chatId, message: err.message });
            }
        });

        socket.on('chat:close', async ({ chatId }) => {
            try {
                await chatService.closeChat(chatId, role, sub);
            } catch (err) {
                socket.emit('chat:error', { chatId, message: err.message });
            }
        });

        // Transfer Constraint enforced server-side in chatService — only same-product online agents.
        socket.on('chat:transfer', async ({ chatId, toAgentId }) => {
            try {
                await chatService.transferChat(chatId, sub, toAgentId);
            } catch (err) {
                socket.emit('chat:error', { chatId, message: err.message });
            }
        });

        socket.on('disconnect', async () => {
            presence.unregister(socket.id);
            console.log(`[Socket] ${role}:${sub} disconnected`);
            // An agent who drops mid-shift shouldn't stay "available" forever.
            if (role === 'agent') {
                const current = await agentState.getStatus(sub);
                if (current === 'available') await agentState.setStatus(sub, 'offline');
            }
        });
    });
}

module.exports = registerSocketHandlers;
