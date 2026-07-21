'use client';

import { useState } from 'react';
import { api } from '@/lib/apiClient';
import { useLiveCalls } from '@/lib/useLiveCalls';
import MonitorModal from '../MonitorModal';

export default function LiveCallsTab() {
    const calls = useLiveCalls();
    const [modal, setModal] = useState(null);
    const [error, setError] = useState('');

    async function monitor(callId, mode) {
        try {
            const result = await api.post(`/calls/${callId}/monitor`, { mode });
            setModal({ mode, ...result });
        } catch (err) {
            setError(err.message);
        }
    }

    async function hangup(callId) {
        try {
            await api.post(`/calls/${callId}/hangup`, {});
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="space-y-2">
            {error && <p className="text-sm text-red-500">{error}</p>}
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2 font-medium">Customer</th>
                        <th className="font-medium">Agent</th>
                        <th className="font-medium">Product</th>
                        <th className="font-medium">Status</th>
                        <th className="font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {calls.map((c) => (
                        <tr key={c.id} className="border-b border-slate-100 dark:border-slate-900">
                            <td className="py-2">{c.customer_name}</td>
                            <td>{c.agent_name}</td>
                            <td>{c.product_name}</td>
                            <td className="capitalize">{c.status}</td>
                            <td className="text-right space-x-1.5 py-2">
                                <button
                                    disabled={c.status !== 'connected'}
                                    onClick={() => monitor(c.id, 'listen')}
                                    className="rounded-md bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white px-2 py-1 text-xs"
                                >
                                    Listen
                                </button>
                                <button
                                    disabled={c.status !== 'connected'}
                                    onClick={() => monitor(c.id, 'whisper')}
                                    className="rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-2 py-1 text-xs"
                                >
                                    Whisper
                                </button>
                                <button
                                    disabled={c.status !== 'connected'}
                                    onClick={() => monitor(c.id, 'barge')}
                                    className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-2 py-1 text-xs"
                                >
                                    Barge
                                </button>
                                <button
                                    onClick={() => hangup(c.id)}
                                    className="rounded-md bg-red-600 hover:bg-red-500 text-white px-2 py-1 text-xs"
                                >
                                    Hangup
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {calls.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No active calls right now.</p>}

            <MonitorModal session={modal} onClose={() => setModal(null)} />
        </div>
    );
}
