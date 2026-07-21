'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/lib/store/chatStore';
import QuotationCard from './QuotationCard';

/** Message list + input, shared by the customer widget and the agent chat window. */
export default function ChatThread({ chat, selfRole, onSend, disabled }) {
    const [text, setText] = useState('');
    const bottomRef = useRef(null);
    const updateMessageQuotation = useChatStore((s) => s.updateMessageQuotation);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chat.messages.length]);

    function submit(e) {
        e.preventDefault();
        if (!text.trim() || disabled) return;
        onSend(text.trim());
        setText('');
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chat.messages.length === 0 && (
                    <p className="text-xs text-slate-400 text-center pt-4">No messages yet.</p>
                )}
                {chat.messages.map((m) =>
                    m.type === 'quotation' && m.quotation ? (
                        <div key={m.id} className="max-w-[85%]">
                            <QuotationCard
                                quotation={m.quotation}
                                canRespond={selfRole === 'customer'}
                                compact
                                onUpdated={(updated) => updateMessageQuotation(chat.id, updated)}
                            />
                        </div>
                    ) : (
                        <div key={m.id} className={`flex ${m.sender_role === selfRole ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                                    m.sender_role === selfRole
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800'
                                }`}
                            >
                                <p>{m.text}</p>
                                <p className={`text-[10px] mt-0.5 ${m.sender_role === selfRole ? 'text-indigo-200' : 'text-slate-400'}`}>
                                    {m.sender_name} · {new Date(m.created_at).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    )
                )}
                <div ref={bottomRef} />
            </div>
            <form onSubmit={submit} className="flex gap-2 p-2 border-t border-slate-200 dark:border-slate-800">
                <input
                    className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
                    placeholder={disabled ? 'Chat closed' : 'Type a message…'}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={disabled}
                />
                <button
                    type="submit"
                    disabled={disabled}
                    className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
                >
                    Send
                </button>
            </form>
        </div>
    );
}
