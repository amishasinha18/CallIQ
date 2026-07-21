'use client';

export default function StatTile({ label, value, sub }) {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
        </div>
    );
}
