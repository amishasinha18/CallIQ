'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { disconnectSocket } from '@/lib/socketClient';
import ThemeToggle from './ThemeToggle';

export default function PortalHeader({ title }) {
    const router = useRouter();
    const { user, logout } = useAuthStore();

    function handleLogout() {
        disconnectSocket();
        logout();
        router.replace('/');
    }

    return (
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
                <span className="font-semibold tracking-tight text-indigo-600 dark:text-indigo-400">CallIQ</span>
                <span className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                <div>
                    <h1 className="font-semibold leading-tight">{title}</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user?.name}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <ThemeToggle />
                <button
                    onClick={handleLogout}
                    className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    Log out
                </button>
            </div>
        </header>
    );
}
