'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '@/lib/apiClient';
import RecordingPlayer from '../RecordingPlayer';

export default function HistoryTab() {
    const [logs, setLogs] = useState([]);
    const [expanded, setExpanded] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/calls/history').then(setLogs).catch((err) => setError(err.message));
    }, []);

    return (
        <div className="space-y-2">
            {error && <p className="text-sm text-red-500">{error}</p>}
            {logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-sm space-y-2">
                    <button
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="w-full text-left flex justify-between gap-3"
                    >
                        <div>
                            <p className="font-medium flex items-center gap-1.5">
                                {log.customer_name}
                                <ArrowLeftRight className="h-3.5 w-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
                                {log.agent_name} — {log.product_name}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs">
                                {new Date(log.started_at).toLocaleString()} · {log.status} · {log.duration_seconds}s
                            </p>
                        </div>
                        <span className="flex items-center gap-1 text-slate-400 text-xs shrink-0">
                            {expanded === log.id ? 'Hide recording' : 'Recording'}
                            {expanded === log.id ? (
                                <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
                            ) : (
                                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                            )}
                        </span>
                    </button>
                    {expanded === log.id && (
                        <div className="pt-1">
                            <RecordingPlayer callId={log.id} hasRecording={!!log.recording_path} />
                        </div>
                    )}
                </div>
            ))}
            {logs.length === 0 && !error && <p className="text-sm text-slate-500 dark:text-slate-400">No calls yet.</p>}
        </div>
    );
}
