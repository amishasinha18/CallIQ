'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import { getSocket } from './socketClient';

/** Wires the shared socket.io chat-signaling events into chatStore. Used by both portals. */
export function useChatSocket() {
    const token = useAuthStore((s) => s.token);
    const socketRef = useRef(null);
    const store = useChatStore;

    useEffect(() => {
        if (!token) return;
        const socket = getSocket(token);
        socketRef.current = socket;

        const onRequest = (payload) => store.getState().addPendingChat(payload);
        const onPending = (payload) => store.getState().setPending(payload);
        const onClaimed = ({ chatId }) => store.getState().removePendingChat(chatId);
        const onAccepted = (payload) => store.getState().setChatAccepted(payload);
        const onMessage = (message) => store.getState().addMessage(message);
        const onClosed = ({ chatId }) => store.getState().chatClosed(chatId);
        const onTransferredAway = ({ chatId }) => store.getState().removeChat(chatId);
        const onTransferredTo = (chat) => store.getState().receiveTransferredChat(chat);
        const onAgentChanged = ({ chatId, agentName }) => store.getState().setAgentChanged(chatId, agentName);
        const onQuotationUpdated = ({ chatId, quotation }) => store.getState().updateMessageQuotation(chatId, quotation);
        const onError = (e) => {
            console.error('[chat:error]', e.message);
            // Lost an accept race — drop the optimistic entry if we made one.
            if (e.chatId) {
                store.getState().removePendingChat(e.chatId);
                store.getState().removeChat(e.chatId);
            }
        };

        socket.on('chat:request', onRequest);
        socket.on('chat:pending', onPending);
        socket.on('chat:claimed', onClaimed);
        socket.on('chat:accepted', onAccepted);
        socket.on('chat:message', onMessage);
        socket.on('chat:closed', onClosed);
        socket.on('chat:transferredAway', onTransferredAway);
        socket.on('chat:transferredTo', onTransferredTo);
        socket.on('chat:agentChanged', onAgentChanged);
        socket.on('chat:quotationUpdated', onQuotationUpdated);
        socket.on('chat:error', onError);

        return () => {
            socket.off('chat:request', onRequest);
            socket.off('chat:pending', onPending);
            socket.off('chat:claimed', onClaimed);
            socket.off('chat:accepted', onAccepted);
            socket.off('chat:message', onMessage);
            socket.off('chat:closed', onClosed);
            socket.off('chat:transferredAway', onTransferredAway);
            socket.off('chat:transferredTo', onTransferredTo);
            socket.off('chat:agentChanged', onAgentChanged);
            socket.off('chat:quotationUpdated', onQuotationUpdated);
            socket.off('chat:error', onError);
        };
    }, [token]);

    return socketRef;
}
