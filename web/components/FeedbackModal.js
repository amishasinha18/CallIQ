'use client';

import { useState } from 'react';
import { api } from '@/lib/apiClient';
import StarRating from './StarRating';

const PARAMS = [
    { key: 'professionalism', label: 'Agent Professionalism' },
    { key: 'callQuality', label: 'Call Quality' },
    { key: 'resolution', label: 'Issue Resolution' },
    { key: 'overall', label: 'Overall Experience' },
];

function StarRow({ label, value, onChange }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
            <StarRating value={value} onChange={onChange} size="h-5 w-5" />
        </div>
    );
}

/** Optional post-call survey — customer side. Star ratings on fixed parameters + a comment. */
export default function FeedbackModal({ callId, onDone, onSkip }) {
    const [ratings, setRatings] = useState({ professionalism: 0, callQuality: 0, resolution: 0, overall: 0 });
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const complete = PARAMS.every((p) => ratings[p.key] > 0);

    async function submit() {
        if (!complete) return;
        setSubmitting(true);
        setError('');
        try {
            await api.post(`/calls/${callId}/feedback`, { ratings, comment });
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
                <h2 className="text-lg font-semibold">How was your call?</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Your feedback helps us improve.</p>

                <div className="space-y-3">
                    {PARAMS.map((p) => (
                        <StarRow
                            key={p.key}
                            label={p.label}
                            value={ratings[p.key]}
                            onChange={(n) => setRatings({ ...ratings, [p.key]: n })}
                        />
                    ))}
                </div>

                <textarea
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    placeholder="Anything else? (optional)"
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button
                    onClick={submit}
                    disabled={!complete || submitting}
                    className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 text-sm font-medium"
                >
                    {submitting ? 'Submitting…' : 'Submit feedback'}
                </button>
                <button onClick={onSkip} className="w-full text-center text-xs text-slate-400 hover:underline">
                    Skip
                </button>
            </div>
        </div>
    );
}
