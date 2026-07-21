'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Star } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { useThemeStore } from '@/lib/store/themeStore';
import StatTile from './StatTile';

// Validated palette (see dataviz skill / references/palette.md) — status colors are
// fixed across modes; the categorical/sequential blue steps for light vs dark.
const COLORS = {
    seriesBlue: { light: '#2a78d6', dark: '#3987e5' },
    good: '#0ca30c',
    warning: '#fab219',
    critical: '#d03b3b',
    muted: '#898781',
    gridline: { light: '#e1e0d9', dark: '#2c2c2a' },
    axisText: '#898781',
};

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

function ProportionBar({ segments, total }) {
    if (total === 0) {
        return <p className="text-sm text-slate-400">No dispositions recorded yet.</p>;
    }
    return (
        <div className="space-y-3">
            <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {segments.map(
                    (s) =>
                        s.value > 0 && (
                            <div
                                key={s.label}
                                style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
                                title={`${s.label}: ${s.value}`}
                            />
                        )
                )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {segments.map((s) => (
                    <div key={s.label} className="flex items-center gap-1.5 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
                        <span className="text-slate-400 tabular-nums">({s.value})</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatusBadge({ label, count, color }) {
    return (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{count}</span>
        </div>
    );
}

export default function DashboardTab() {
    const [stats, setStats] = useState(null);
    const [error, setError] = useState('');
    const theme = useThemeStore((s) => s.theme);

    useEffect(() => {
        api.get('/admin/stats').then(setStats).catch((err) => setError(err.message));
    }, []);

    if (error) return <p className="text-sm text-red-500">{error}</p>;
    if (!stats) return <p className="text-sm text-slate-400">Loading dashboard…</p>;

    const barColor = theme === 'dark' ? COLORS.seriesBlue.dark : COLORS.seriesBlue.light;
    const gridColor = theme === 'dark' ? COLORS.gridline.dark : COLORS.gridline.light;
    const chartData = stats.callsLast7Days.map((d) => ({
        ...d,
        label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }),
    }));

    const dispositionTotal = Object.values(stats.dispositionBreakdown).reduce((a, b) => a + b, 0);
    const dispositionSegments = [
        { label: 'Success', value: stats.dispositionBreakdown.Success, color: COLORS.good },
        { label: 'Callback Required', value: stats.dispositionBreakdown['Callback Required'], color: COLORS.warning },
        { label: 'Failed', value: stats.dispositionBreakdown.Failed, color: COLORS.critical },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatTile label="Calls Today" value={stats.callsToday} />
                <StatTile label="Chats Today" value={stats.chatsToday} />
                <StatTile label="Avg Call Duration" value={formatDuration(stats.avgCallDurationSeconds)} />
                <StatTile label="Completion Rate" value={`${Math.round(stats.completionRate * 100)}%`} />
                <StatTile
                    label="Avg Rating"
                    value={
                        stats.avgOverallRating ? (
                            <span className="flex items-center gap-1.5">
                                {stats.avgOverallRating.toFixed(1)}
                                <Star className="h-4 w-4 text-amber-400 fill-amber-400" strokeWidth={1.5} />
                            </span>
                        ) : (
                            '—'
                        )
                    }
                    sub={stats.feedbackCount ? `${stats.feedbackCount} reviews` : 'No feedback yet'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <h3 className="text-sm font-semibold mb-3">Calls — last 7 days</h3>
                    <div style={{ width: '100%', height: 220 }}>
                        <ResponsiveContainer>
                            <BarChart data={chartData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke={gridColor} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: COLORS.axisText, fontSize: 12 }}
                                    axisLine={{ stroke: gridColor }}
                                    tickLine={false}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fill: COLORS.axisText, fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={28}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(137,135,129,0.1)' }}
                                    contentStyle={{
                                        background: theme === 'dark' ? '#1a1a19' : '#fcfcfb',
                                        border: `1px solid ${gridColor}`,
                                        borderRadius: 8,
                                        fontSize: 12,
                                    }}
                                />
                                <Bar dataKey="count" fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={36}>
                                    <LabelList
                                        dataKey="count"
                                        position="top"
                                        style={{ fill: theme === 'dark' ? '#ffffff' : '#0b0b0b', fontSize: 11 }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <h3 className="text-sm font-semibold mb-4">Disposition breakdown</h3>
                    <ProportionBar segments={dispositionSegments} total={dispositionTotal} />
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <h3 className="text-sm font-semibold mb-3">Agents right now</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatusBadge label="Available" count={stats.agentStatusBreakdown.available} color={COLORS.good} />
                    <StatusBadge label="On call" count={stats.agentStatusBreakdown.busy} color={barColor} />
                    <StatusBadge label="Break" count={stats.agentStatusBreakdown.break} color={COLORS.warning} />
                    <StatusBadge label="Offline" count={stats.agentStatusBreakdown.offline} color={COLORS.muted} />
                </div>
            </div>
        </div>
    );
}
