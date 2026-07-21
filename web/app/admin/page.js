'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import PortalHeader from '@/components/PortalHeader';
import DashboardTab from '@/components/admin/DashboardTab';
import ProductsTab from '@/components/admin/ProductsTab';
import AgentsTab from '@/components/admin/AgentsTab';
import HistoryTab from '@/components/admin/HistoryTab';
import LiveCallsTab from '@/components/admin/LiveCallsTab';

const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'products', label: 'Products' },
    { key: 'agents', label: 'Agents' },
    { key: 'history', label: 'Call Logs' },
    { key: 'live', label: 'Live Calls' },
];

export default function AdminPage() {
    const router = useRouter();
    const { token, user } = useAuthStore();
    const [tab, setTab] = useState('dashboard');

    useEffect(() => {
        if (!token || user?.role !== 'admin') router.replace('/');
    }, [token, user, router]);

    if (!user) return null;

    return (
        <main className="min-h-screen">
            <PortalHeader title="Admin Dashboard" />

            <div className="max-w-6xl mx-auto p-6 space-y-6">
                <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden w-fit text-sm">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-4 py-1.5 ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'dashboard' && <DashboardTab />}
                {tab === 'products' && <ProductsTab />}
                {tab === 'agents' && <AgentsTab />}
                {tab === 'history' && <HistoryTab />}
                {tab === 'live' && <LiveCallsTab />}
            </div>
        </main>
    );
}
