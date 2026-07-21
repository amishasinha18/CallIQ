'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadFile } from '@/lib/downloadFile';
import { api } from '@/lib/apiClient';

const STATUS_STYLES = {
    pending: 'text-amber-600 dark:text-amber-400',
    accepted: 'text-emerald-600 dark:text-emerald-400',
    rejected: 'text-red-500',
};

/** Shared quotation display — used on the customer's "My Quotations" tab, the agent's call-detail page, and inline in chat threads. */
export default function QuotationCard({ quotation, canRespond, onUpdated, compact }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function respond(action) {
        setBusy(true);
        setError('');
        try {
            const updated = await api.post(`/quotations/${quotation.id}/${action}`, {});
            onUpdated?.(updated);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function download() {
        try {
            await downloadFile(`/quotations/${quotation.id}/pdf`, `quotation-${quotation.id}.pdf`);
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className={`rounded-xl border-2 border-indigo-500 bg-white dark:bg-slate-900 space-y-2 ${compact ? 'p-3' : 'p-5'}`}>
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-indigo-500 font-semibold">Quotation</p>
                <span className={`text-xs font-medium capitalize ${STATUS_STYLES[quotation.status || 'pending']}`}>
                    {quotation.status || 'pending'}
                </span>
            </div>
            <h3 className="font-semibold">{quotation.product_name}</h3>
            {!compact && quotation.product_description && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{quotation.product_description}</p>
            )}
            <p className="text-xl font-bold">${Number(quotation.price).toFixed(2)}</p>
            {quotation.customer_name && <p className="text-xs text-slate-500 dark:text-slate-400">Prepared for {quotation.customer_name}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
                <button
                    onClick={download}
                    className="flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs"
                >
                    <Download className="h-3.5 w-3.5" strokeWidth={2} />
                    Download PDF
                </button>
                {canRespond && (quotation.status || 'pending') === 'pending' && (
                    <>
                        <button
                            onClick={() => respond('accept')}
                            disabled={busy}
                            className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 text-xs"
                        >
                            Accept
                        </button>
                        <button
                            onClick={() => respond('reject')}
                            disabled={busy}
                            className="rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1.5 text-xs"
                        >
                            Reject
                        </button>
                    </>
                )}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}
