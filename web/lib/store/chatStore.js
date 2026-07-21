'use client';

import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
    // Agent only: ring-all requests not yet claimed by anyone.
    pendingChats: [],
    // Both roles: chats this user currently owns/participates in, keyed by chatId.
    chats: {},
    activeChatId: null,

    addPendingChat: (payload) =>
        set((s) => ({ pendingChats: [...s.pendingChats.filter((c) => c.chatId !== payload.chatId), payload] })),

    // Customer's own request, echoed back so their widget has something to show immediately.
    setPending: (payload) =>
        set({
            chats: {
                [payload.chatId]: {
                    id: payload.chatId,
                    status: 'PENDING',
                    product_name: payload.productName,
                    messages: [],
                },
            },
            activeChatId: payload.chatId,
        }),

    removePendingChat: (chatId) => set((s) => ({ pendingChats: s.pendingChats.filter((c) => c.chatId !== chatId) })),

    // Optimistic: agent assumes their accept wins until told otherwise via chat:error.
    openChatOptimistic: (payload) =>
        set((s) => ({
            pendingChats: s.pendingChats.filter((c) => c.chatId !== payload.chatId),
            chats: {
                ...s.chats,
                [payload.chatId]: {
                    id: payload.chatId,
                    status: 'ASSIGNED',
                    customer_name: payload.customerName,
                    product_name: payload.productName,
                    messages: [],
                },
            },
            activeChatId: payload.chatId,
        })),

    setChatAccepted: (payload) =>
        set((s) => ({
            chats: {
                ...s.chats,
                [payload.chatId]: {
                    id: payload.chatId,
                    status: 'ASSIGNED',
                    agent_name: payload.agentName,
                    messages: [],
                },
            },
            activeChatId: payload.chatId,
        })),

    addMessage: (message) =>
        set((s) => {
            const existing = s.chats[message.chat_id];
            if (!existing) return {};
            return {
                chats: {
                    ...s.chats,
                    [message.chat_id]: {
                        ...existing,
                        status: existing.status === 'ASSIGNED' ? 'ACTIVE' : existing.status,
                        messages: [...existing.messages, message],
                    },
                },
            };
        }),

    // A quotation sent inside this chat was accepted/rejected — patch the embedded copy on its message.
    updateMessageQuotation: (chatId, quotation) =>
        set((s) => {
            const existing = s.chats[chatId];
            if (!existing) return {};
            return {
                chats: {
                    ...s.chats,
                    [chatId]: {
                        ...existing,
                        messages: existing.messages.map((m) =>
                            m.quotation_id === quotation.id ? { ...m, quotation } : m
                        ),
                    },
                },
            };
        }),

    chatClosed: (chatId) =>
        set((s) => {
            const existing = s.chats[chatId];
            if (!existing) return {};
            return { chats: { ...s.chats, [chatId]: { ...existing, status: 'CLOSED' } } };
        }),

    // Agent lost this chat to a transfer.
    removeChat: (chatId) =>
        set((s) => {
            const next = { ...s.chats };
            delete next[chatId];
            return { chats: next, activeChatId: get().activeChatId === chatId ? null : get().activeChatId };
        }),

    // Agent received a chat via transfer.
    receiveTransferredChat: (chat) =>
        set((s) => ({
            chats: {
                ...s.chats,
                [chat.id]: {
                    id: chat.id,
                    status: chat.status,
                    customer_name: chat.customer_name,
                    product_name: chat.product_name,
                    messages: [],
                },
            },
            activeChatId: chat.id,
        })),

    // Customer's chat got handed to a different agent.
    setAgentChanged: (chatId, agentName) =>
        set((s) => {
            const existing = s.chats[chatId];
            if (!existing) return {};
            return { chats: { ...s.chats, [chatId]: { ...existing, agent_name: agentName } } };
        }),

    setActiveChatId: (chatId) => set({ activeChatId: chatId }),

    reset: () => set({ pendingChats: [], chats: {}, activeChatId: null }),
}));
