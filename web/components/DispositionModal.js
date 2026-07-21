'use client';

import { useState } from 'react';
import { api } from '@/lib/apiClient';

const OUTCOMES = ['Success', 'Failed', 'Callback Required'];

/** Mandatory post-call popup — agent can't dismiss without picking an outcome. */
export default function DispositionModal({ callId, onDone }) {
    const [outcome, setOutcome] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    async function submit() {
        if (!outcome) return;
        setSubmitting(true);
        setError('');
        try {
            await api.post(`/calls/${callId}/disposition`, { outcome, notes });
            onDone();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-sm w-full space-y-4">
                <h2 className="text-lg font-semibold">Wrap up this call</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Select an outcome before continuing.
                </p>
                <div className="space-y-2">
                    {OUTCOMES.map((o) => (
                        <label
                            key={o}
                            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                                outcome === o
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                                    : 'border-slate-300 dark:border-slate-700'
                            }`}
                        >
                            <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} />
                            {o}
                        </label>
                    ))}
                </div>
                <textarea
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    placeholder="Notes (optional)"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                    onClick={submit}
                    disabled={!outcome || submitting}
                    className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 text-sm font-medium"
                >
                    {submitting ? 'Saving…' : 'Save & Continue'}
                </button>
            </div>
        </div>
    );
}
