'use client';

import { useChatStore } from '@/lib/store/chatStore';
import ChatThread from './ChatThread';

export default function CustomerChatWidget({ socket }) {
    const { chats, activeChatId, reset } = useChatStore();
    const chat = activeChatId ? chats[activeChatId] : null;

    if (!chat) return null;

    function handleClose() {
        if (chat.status === 'PENDING') socket.emit('chat:cancel', { chatId: chat.id });
        else if (chat.status === 'ASSIGNED' || chat.status === 'ACTIVE') socket.emit('chat:close', { chatId: chat.id });
        reset();
    }

    return (
        <div className="fixed bottom-4 right-4 z-40 w-80 h-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-indigo-600 text-white flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">
                        {chat.status === 'ASSIGNED' || chat.status === 'ACTIVE' ? chat.agent_name : 'Waiting for an agent…'}
                    </p>
                    <p className="text-xs text-indigo-100">{chat.product_name}</p>
                </div>
                <button onClick={handleClose} className="text-white/80 hover:text-white text-lg leading-none">
                    ×
                </button>
            </div>

            {chat.status === 'PENDING' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400 px-4 text-center">
                    <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" />
                    </div>
                    <p>Waiting for an agent to accept your chat…</p>
                    <button onClick={handleClose} className="text-red-500 hover:underline text-xs">
                        Cancel
                    </button>
                </div>
            )}

            {(chat.status === 'ASSIGNED' || chat.status === 'ACTIVE') && (
                <ChatThread
                    chat={chat}
                    selfRole="customer"
                    onSend={(text) => socket.emit('chat:message', { chatId: chat.id, text })}
                />
            )}

            {chat.status === 'CLOSED' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <p>This chat has ended.</p>
                    <button onClick={reset} className="text-indigo-500 hover:underline text-xs">
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}
