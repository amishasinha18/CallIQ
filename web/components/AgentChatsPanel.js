'use client';

import { useState } from 'react';
import { useChatStore } from '@/lib/store/chatStore';
import { api } from '@/lib/apiClient';
import ChatThread from './ChatThread';

export default function AgentChatsPanel({ socket }) {
    const { pendingChats, chats, activeChatId, setActiveChatId, openChatOptimistic } = useChatStore();
    const [candidates, setCandidates] = useState([]);
    const [showTransfer, setShowTransfer] = useState(false);
    const [sendingQuote, setSendingQuote] = useState(false);

    const activeChats = Object.values(chats).filter((c) => c.status !== 'CLOSED');
    const selected = activeChatId ? chats[activeChatId] : null;

    function accept(pending) {
        openChatOptimistic(pending);
        socket.emit('chat:accept', { chatId: pending.chatId });
    }

    async function openTransferMenu() {
        setShowTransfer(true);
        try {
            const list = await api.get(`/chats/${selected.id}/transfer-candidates`);
            setCandidates(list);
        } catch {
            setCandidates([]);
        }
    }

    function transferTo(agentId) {
        socket.emit('chat:transfer', { chatId: selected.id, toAgentId: agentId });
        setShowTransfer(false);
    }

    function closeChat() {
        socket.emit('chat:close', { chatId: selected.id });
    }

    async function sendQuotation() {
        setSendingQuote(true);
        try {
            await api.post('/quotations', { chatId: selected.id });
            // The resulting message (with the quotation card) arrives via the chat:message socket event.
        } catch {
            // Surfaced inline via the chat itself is enough for this action; no dedicated error UI.
        } finally {
            setSendingQuote(false);
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[32rem]">
            <div className="space-y-4 overflow-y-auto pr-1">
                <div>
                    <h3 className="text-sm font-semibold mb-2">Pending Chats ({pendingChats.length})</h3>
                    <div className="space-y-2">
                        {pendingChats.map((c) => (
                            <div key={c.chatId} className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950 p-2.5 text-sm">
                                <p className="font-medium">{c.customerName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{c.productName}</p>
                                <button
                                    onClick={() => accept(c)}
                                    className="mt-1.5 w-full rounded-md bg-emerald-600 hover:bg-emerald-500 text-white py-1 text-xs"
                                >
                                    Accept
                                </button>
                            </div>
                        ))}
                        {pendingChats.length === 0 && <p className="text-xs text-slate-400">Nothing waiting.</p>}
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-semibold mb-2">Your Chats ({activeChats.length})</h3>
                    <div className="space-y-2">
                        {activeChats.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => setActiveChatId(c.id)}
                                className={`w-full text-left rounded-lg border p-2.5 text-sm ${
                                    activeChatId === c.id
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                                        : 'border-slate-200 dark:border-slate-800'
                                }`}
                            >
                                <p className="font-medium">{c.customer_name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {c.product_name} · {c.status}
                                </p>
                            </button>
                        ))}
                        {activeChats.length === 0 && <p className="text-xs text-slate-400">No open chats.</p>}
                    </div>
                </div>
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                {!selected && (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                        Select a chat to view the conversation.
                    </div>
                )}
                {selected && (
                    <>
                        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">{selected.customer_name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{selected.product_name}</p>
                            </div>
                            {selected.status !== 'CLOSED' && (
                                <div className="flex gap-1.5 relative">
                                    <button
                                        onClick={sendQuotation}
                                        disabled={sendingQuote}
                                        className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs disabled:opacity-50"
                                    >
                                        {sendingQuote ? 'Sending…' : 'Send Quotation'}
                                    </button>
                                    <button
                                        onClick={openTransferMenu}
                                        className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs"
                                    >
                                        Transfer
                                    </button>
                                    <button
                                        onClick={closeChat}
                                        className="rounded-md bg-red-600 hover:bg-red-500 text-white px-2 py-1 text-xs"
                                    >
                                        Close
                                    </button>
                                    {showTransfer && (
                                        <div className="absolute right-0 top-8 z-10 w-48 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-1">
                                            {candidates.length === 0 && (
                                                <p className="text-xs text-slate-400 p-2">No other online agents for this product.</p>
                                            )}
                                            {candidates.map((a) => (
                                                <button
                                                    key={a.id}
                                                    onClick={() => transferTo(a.id)}
                                                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                                >
                                                    {a.name}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setShowTransfer(false)}
                                                className="w-full text-left text-xs px-2 py-1.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-h-0">
                            <ChatThread
                                chat={selected}
                                selfRole="agent"
                                onSend={(text) => socket.emit('chat:message', { chatId: selected.id, text })}
                                disabled={selected.status === 'CLOSED'}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
