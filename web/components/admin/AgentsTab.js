'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export default function AgentsTab() {
    const [agents, setAgents] = useState([]);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [resetting, setResetting] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');

    const reload = useCallback(() => {
        api.get('/agents').then(setAgents).catch((err) => setError(err.message));
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    async function createAgent(e) {
        e.preventDefault();
        try {
            await api.post('/agents', form);
            setForm({ name: '', email: '', password: '' });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function deleteAgent(id) {
        try {
            await api.del(`/agents/${id}`);
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function resetCredentials(id) {
        try {
            await api.patch(`/agents/${id}/credentials`, { password: newPassword });
            setResetting(null);
            setNewPassword('');
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="space-y-6">
            <form onSubmit={createAgent} className="flex flex-wrap gap-2 items-end">
                <input
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    placeholder="Name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                />
                <input
                    type="email"
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                />
                <input
                    type="password"
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    placeholder="Temporary password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                />
                <button className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium">
                    Add agent
                </button>
            </form>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="space-y-2">
                {agents.map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-sm space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{a.name}</p>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">{a.email}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                        a.status === 'available'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                            : a.status === 'break'
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}
                                >
                                    {a.status}
                                </span>
                                <button onClick={() => setResetting(a.id)} className="text-xs text-indigo-500 hover:underline">
                                    Reset password
                                </button>
                                <button onClick={() => deleteAgent(a.id)} className="text-xs text-red-500 hover:underline">
                                    Remove
                                </button>
                            </div>
                        </div>
                        {resetting === a.id && (
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                                    placeholder="New password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                                <button
                                    onClick={() => resetCredentials(a.id)}
                                    className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs"
                                >
                                    Save
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
