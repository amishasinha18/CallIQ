'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, FileText } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { useCallStore } from '@/lib/store/callStore';
import { useCallSocket } from '@/lib/useCallSocket';
import { useChatStore } from '@/lib/store/chatStore';
import { useChatSocket } from '@/lib/useChatSocket';
import { api } from '@/lib/apiClient';
import PortalHeader from '@/components/PortalHeader';
import ProductCard from '@/components/ProductCard';
import CallOverlay from '@/components/CallOverlay';
import CustomerChatWidget from '@/components/CustomerChatWidget';
import QuotationCard from '@/components/QuotationCard';
import FeedbackModal from '@/components/FeedbackModal';

export default function CustomerPage() {
    const router = useRouter();
    const { token, user } = useAuthStore();
    const socketRef = useCallSocket();
    useChatSocket(); // shares the same underlying socket; just registers chat listeners
    const status = useCallStore((s) => s.status);
    const callId = useCallStore((s) => s.callId);
    const reset = useCallStore((s) => s.reset);
    const activeChatId = useChatStore((s) => s.activeChatId);
    const [tab, setTab] = useState('products');
    const [products, setProducts] = useState([]);
    const [chatAvailability, setChatAvailability] = useState({});
    const [quotations, setQuotations] = useState([]);
    const [newQuotation, setNewQuotation] = useState(false);
    const [pendingFeedbackCallId, setPendingFeedbackCallId] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token || user?.role !== 'customer') router.replace('/');
    }, [token, user, router]);

    useEffect(() => {
        if (!token) return;
        api.get('/products').then(setProducts).catch((err) => setError(err.message));
    }, [token]);

    function loadChatAvailability() {
        api.get('/chats/availability').then(setChatAvailability).catch(() => {});
    }

    useEffect(() => {
        if (!token) return;
        loadChatAvailability();
        // Presence changes as agents log in/out — light polling keeps the button accurate.
        const interval = setInterval(loadChatAvailability, 15000);
        return () => clearInterval(interval);
    }, [token]);

    function loadQuotations() {
        api.get('/quotations').then(setQuotations).catch((err) => setError(err.message));
    }

    useEffect(() => {
        if (tab === 'quotations') loadQuotations();
    }, [tab]);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;
        const onNewQuotation = () => {
            setNewQuotation(true);
            if (tab === 'quotations') loadQuotations();
        };
        socket.on('quotation:new', onNewQuotation);
        return () => socket.off('quotation:new', onNewQuotation);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socketRef.current, tab]);

    useEffect(() => {
        if (status === 'ended' && callId) {
            setPendingFeedbackCallId(callId);
        }
    }, [status, callId]);

    function handleFeedbackDone() {
        setPendingFeedbackCallId(null);
        reset();
    }

    function handleTalkToAgent(product) {
        socketRef.current?.emit('call:request', { productId: product.id });
    }

    function handleStartChat(product) {
        socketRef.current?.emit('chat:request', { productId: product.id });
    }

    if (!user) return null;

    const busy = (status !== 'idle' && status !== 'ended') || !!activeChatId;

    return (
        <main className="min-h-screen">
            <PortalHeader title="Product Catalogue" />

            <div className="max-w-5xl mx-auto p-6 space-y-6">
                <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden w-fit text-sm shadow-sm">
                    <button
                        onClick={() => setTab('products')}
                        className={`flex items-center gap-1.5 px-4 py-1.5 transition-colors ${
                            tab === 'products'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <Package className="h-3.5 w-3.5" strokeWidth={2} />
                        Products
                    </button>
                    <button
                        onClick={() => {
                            setTab('quotations');
                            setNewQuotation(false);
                        }}
                        className={`relative flex items-center gap-1.5 px-4 py-1.5 transition-colors ${
                            tab === 'quotations'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                        My Quotations
                        {newQuotation && tab !== 'quotations' && (
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                        )}
                    </button>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                {tab === 'products' && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {products.map((p) => (
                                <ProductCard
                                    key={p.id}
                                    product={p}
                                    onTalkToAgent={handleTalkToAgent}
                                    onStartChat={handleStartChat}
                                    canChat={(chatAvailability[p.id] || 0) > 0}
                                    disabled={busy}
                                />
                            ))}
                        </div>
                        {products.length === 0 && !error && (
                            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                                <Package className="h-6 w-6 text-slate-400 mx-auto mb-2" strokeWidth={1.5} />
                                <p className="text-sm text-slate-500 dark:text-slate-400">No products available yet.</p>
                            </div>
                        )}
                    </>
                )}

                {tab === 'quotations' && (
                    <div className="space-y-3 max-w-lg">
                        {quotations.map((q) => (
                            <QuotationCard
                                key={q.id}
                                quotation={q}
                                canRespond
                                onUpdated={(updated) =>
                                    setQuotations((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                                }
                            />
                        ))}
                        {quotations.length === 0 && (
                            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                                <FileText className="h-6 w-6 text-slate-400 mx-auto mb-2" strokeWidth={1.5} />
                                <p className="text-sm text-slate-500 dark:text-slate-400">No quotations yet.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <CallOverlay socket={socketRef.current} role="customer" />
            <CustomerChatWidget socket={socketRef.current} />

            {pendingFeedbackCallId && (
                <FeedbackModal callId={pendingFeedbackCallId} onDone={handleFeedbackDone} onSkip={handleFeedbackDone} />
            )}
        </main>
    );
}
