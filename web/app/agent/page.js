'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Package } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { useCallStore } from '@/lib/store/callStore';
import { useCallSocket } from '@/lib/useCallSocket';
import { useChatStore } from '@/lib/store/chatStore';
import { useChatSocket } from '@/lib/useChatSocket';
import { api } from '@/lib/apiClient';
import PortalHeader from '@/components/PortalHeader';
import CallOverlay from '@/components/CallOverlay';
import WhisperAudio from '@/components/WhisperAudio';
import DispositionModal from '@/components/DispositionModal';
import AgentChatsPanel from '@/components/AgentChatsPanel';
import PersonalStatsPanel from '@/components/agent/PersonalStatsPanel';

const STATUSES = ['available', 'break', 'offline'];

export default function AgentPage() {
    const router = useRouter();
    const { token, user } = useAuthStore();
    const socketRef = useCallSocket();
    useChatSocket();
    const status = useCallStore((s) => s.status);
    const callId = useCallStore((s) => s.callId);
    const reset = useCallStore((s) => s.reset);
    const pendingChatsCount = useChatStore((s) => s.pendingChats.length);

    const [tab, setTab] = useState('workspace');
    const [agentStatus, setAgentStatus] = useState('offline');
    const [products, setProducts] = useState([]);
    const [history, setHistory] = useState([]);
    const [pendingDisposition, setPendingDisposition] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token || user?.role !== 'agent') router.replace('/');
    }, [token, user, router]);

    const loadHistory = useCallback(() => {
        api.get('/calls/history').then(setHistory).catch((err) => setError(err.message));
    }, []);

    useEffect(() => {
        if (!token) return;
        api.get('/agents/me').then((a) => setAgentStatus(a.status)).catch((err) => setError(err.message));
        api.get('/agents/me/products').then(setProducts).catch((err) => setError(err.message));
        loadHistory();
    }, [token, loadHistory]);

    // A completed call needs a mandatory disposition before the agent can move on.
    useEffect(() => {
        if (status === 'ended' && callId) {
            setPendingDisposition(callId);
        }
    }, [status, callId]);

    async function changeStatus(next) {
        try {
            const res = await api.patch('/agents/me/status', { status: next });
            setAgentStatus(res.status);
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleOutdial(log) {
        try {
            await api.post('/calls/outdial', { customerId: log.customer_id, productId: log.product_id });
        } catch (err) {
            setError(err.message);
        }
    }

    function handleDispositionDone() {
        setPendingDisposition(null);
        reset();
        loadHistory();
    }

    if (!user) return null;

    return (
        <main className="min-h-screen">
            <PortalHeader title="Agent Workspace" />

            <div className="max-w-4xl mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {STATUSES.map((s) => (
                            <button
                                key={s}
                                onClick={() => changeStatus(s)}
                                className={`px-4 py-1.5 text-sm capitalize transition-colors ${
                                    agentStatus === s
                                        ? s === 'available'
                                            ? 'bg-emerald-600 text-white'
                                            : s === 'break'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-slate-500 text-white'
                                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-sm">
                        <button
                            onClick={() => setTab('workspace')}
                            className={`px-4 py-1.5 transition-colors ${tab === 'workspace' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            Workspace
                        </button>
                        <button
                            onClick={() => setTab('history')}
                            className={`px-4 py-1.5 transition-colors ${tab === 'history' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            History
                        </button>
                        <button
                            onClick={() => setTab('chats')}
                            className={`relative px-4 py-1.5 transition-colors ${tab === 'chats' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            Chats
                            {pendingChatsCount > 0 && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                                    {pendingChatsCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                {tab === 'workspace' && (
                    <div className="space-y-6">
                        <PersonalStatsPanel />

                        <div>
                            <h2 className="font-medium mb-2">Your assigned products</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {products.map((p) => (
                                    <div
                                        key={p.id}
                                        className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm shadow-sm"
                                    >
                                        <Package className="h-4 w-4 text-indigo-500 shrink-0" strokeWidth={1.75} />
                                        {p.name}
                                    </div>
                                ))}
                                {products.length === 0 && (
                                    <div className="col-span-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
                                        <Package className="h-6 w-6 text-slate-400 mx-auto mb-2" strokeWidth={1.5} />
                                        <p className="text-sm text-slate-500 dark:text-slate-400">No products assigned yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'history' && (
                    <div className="space-y-2">
                        {history.map((log) => (
                            <button
                                key={log.id}
                                onClick={() => router.push(`/agent/calls/${log.id}`)}
                                className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div>
                                    <p className="font-medium">
                                        {log.customer_name} — {log.product_name}
                                    </p>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                                        {new Date(log.started_at).toLocaleString()} · {log.status} ·{' '}
                                        {log.duration_seconds}s
                                    </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOutdial(log);
                                        }}
                                        className="flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs cursor-pointer"
                                    >
                                        <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                                        Callback
                                    </span>
                                </div>
                            </button>
                        ))}
                        {history.length === 0 && (
                            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
                                <p className="text-sm text-slate-500 dark:text-slate-400">No calls handled yet.</p>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'chats' && <AgentChatsPanel socket={socketRef.current} />}
            </div>

            <CallOverlay socket={socketRef.current} role="agent" />
            <WhisperAudio />

            {pendingDisposition && <DispositionModal callId={pendingDisposition} onDone={handleDispositionDone} />}
        </main>
    );
}
