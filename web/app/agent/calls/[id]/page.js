'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/apiClient';
import PortalHeader from '@/components/PortalHeader';
import RecordingPlayer from '@/components/RecordingPlayer';
import QuotationCard from '@/components/QuotationCard';

export default function CallDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [log, setLog] = useState(null);
    const [quotation, setQuotation] = useState(null);
    const [error, setError] = useState('');
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        api.get(`/calls/${id}`).then(setLog).catch((err) => setError(err.message));
        // A quotation may already have been generated for this call on an earlier visit.
        api
            .get('/quotations')
            .then((list) => {
                const existing = list.find((q) => q.call_log_id === id);
                if (existing) setQuotation(existing);
            })
            .catch(() => {});
    }, [id]);

    async function generateQuotation() {
        setGenerating(true);
        setError('');
        try {
            const q = await api.post('/quotations', { callLogId: id });
            setQuotation(q);
        } catch (err) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    }

    if (error && !log) return <main className="p-6 text-red-500 text-sm">{error}</main>;
    if (!log) return <main className="p-6 text-sm text-slate-500">Loading…</main>;

    return (
        <main className="min-h-screen">
            <PortalHeader title="Call Details" />

            <div className="max-w-lg mx-auto p-6 space-y-6">
                <button
                    onClick={() => router.push('/agent')}
                    className="flex items-center gap-1.5 text-sm text-indigo-500 hover:underline"
                >
                    <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                    Back to workspace
                </button>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 space-y-2 text-sm">
                    <Row label="Customer" value={log.customer_name} />
                    <Row label="Product" value={log.product_name} />
                    <Row label="Status" value={log.status} />
                    <Row label="Date" value={new Date(log.started_at).toLocaleDateString()} />
                    <Row label="Started" value={new Date(log.started_at).toLocaleTimeString()} />
                    {log.ended_at && <Row label="Ended" value={new Date(log.ended_at).toLocaleTimeString()} />}
                    <Row label="Duration" value={`${log.duration_seconds}s`} />
                    {log.disposition_id && <Row label="Disposition" value={log.disposition_id ? 'Recorded' : '—'} />}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
                        Call Recording
                    </p>
                    <RecordingPlayer callId={id} hasRecording={!!log.recording_path} />
                </div>

                {!quotation ? (
                    <button
                        onClick={generateQuotation}
                        disabled={generating}
                        className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 text-sm font-medium"
                    >
                        {generating ? 'Generating…' : 'Generate & Send Quotation'}
                    </button>
                ) : (
                    <QuotationCard
                        quotation={quotation}
                        canRespond={false}
                        onUpdated={setQuotation}
                    />
                )}

                {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
        </main>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}
