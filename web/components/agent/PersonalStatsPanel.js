'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import StatTile from '@/components/admin/StatTile';
import StarRating from '@/components/StarRating';

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

/** Agent's own personalized numbers + recent customer reviews for calls they personally handled. */
export default function PersonalStatsPanel() {
    const [stats, setStats] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/agents/me/stats').then(setStats).catch((err) => setError(err.message));
    }, []);

    if (error) return <p className="text-sm text-red-500">{error}</p>;
    if (!stats) return <p className="text-sm text-slate-400">Loading your stats…</p>;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Calls Today" value={stats.callsToday} />
                <StatTile label="Calls Handled" value={stats.callsHandledTotal} />
                <StatTile label="Avg Call Duration" value={formatDuration(stats.avgCallDurationSeconds)} />
                <StatTile
                    label="Your Rating"
                    value={
                        stats.avgOverallRating ? (
                            <span className="flex items-center gap-1.5 text-2xl">
                                {stats.avgOverallRating.toFixed(1)}
                                <StarRating value={stats.avgOverallRating} size="h-4 w-4" />
                            </span>
                        ) : (
                            '—'
                        )
                    }
                    sub={stats.feedbackCount ? `${stats.feedbackCount} reviews` : 'No reviews yet'}
                />
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <h3 className="text-sm font-semibold mb-3">Recent reviews</h3>
                {stats.recentReviews.length === 0 && (
                    <p className="text-sm text-slate-400">No customer reviews yet.</p>
                )}
                <div className="space-y-3">
                    {stats.recentReviews.map((r) => (
                        <div key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 pb-3 last:pb-0">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">{r.customer_name}</p>
                                <StarRating value={r.ratings.overall} size="h-3.5 w-3.5" />
                            </div>
                            {r.comment && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{r.comment}</p>}
                            <p className="text-xs text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
