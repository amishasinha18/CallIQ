'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Shield, MessageCircle, BarChart3, Square, Circle, Triangle, Diamond, Hexagon } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import ThemeToggle from '@/components/ThemeToggle';
import AuthModal from '@/components/AuthModal';

const FEATURES = [
    {
        icon: Target,
        title: 'Smart Routing',
        body: 'Calls go to the longest-idle agent assigned to that product automatically. Chats ring every available agent at once — first to accept wins.',
    },
    {
        icon: Shield,
        title: 'Live Monitoring',
        body: 'Supervisors can silently Listen, privately Whisper to an agent, or Barge in as a third participant on any live call — without the customer ever knowing.',
    },
    {
        icon: MessageCircle,
        title: 'Unified Voice + Chat',
        body: 'One inbox for phone and text. Agents accept, transfer, and resolve conversations from a single workspace, backed by real WebRTC calling.',
    },
    {
        icon: BarChart3,
        title: 'Analytics & Quotations',
        body: 'Call recordings, customer feedback, and a live dashboard of what’s happening today — plus one-click quotations agents can send from any conversation.',
    },
];

const STEPS = [
    {
        step: '01',
        title: 'Customer reaches out',
        body: 'From any product page, a customer clicks Call or Text — whichever channel has an agent free.',
    },
    {
        step: '02',
        title: 'Routed instantly',
        body: 'CallIQ finds the right available agent in real time, no dispatcher required.',
    },
    {
        step: '03',
        title: 'Resolved & tracked',
        body: 'The conversation, recording, disposition, and customer feedback are all captured automatically.',
    },
];

// Generic placeholder marks — not real company logos — purely for understated social-proof styling.
const TRUST_MARKS = [
    { name: 'Acme', icon: Square },
    { name: 'Nova', icon: Circle },
    { name: 'Vertex', icon: Triangle },
    { name: 'Orbit', icon: Diamond },
    { name: 'Flux', icon: Hexagon },
];

export default function HomePage() {
    const router = useRouter();
    const { token, user } = useAuthStore();
    const [authMode, setAuthMode] = useState(null); // null | 'login' | 'signup'

    useEffect(() => {
        if (token && user) router.replace(`/${user.role}`);
    }, [token, user, router]);

    return (
        <main className="min-h-screen">
            <header className="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <span className="font-semibold text-lg tracking-tight text-indigo-600 dark:text-indigo-400">
                        CallIQ
                    </span>
                    <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
                        <a href="#features" className="hover:text-indigo-500">Features</a>
                        <a href="#how-it-works" className="hover:text-indigo-500">How it works</a>
                    </nav>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button
                            onClick={() => setAuthMode('login')}
                            className="rounded-lg px-4 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setAuthMode('signup')}
                            className="rounded-lg px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white"
                        >
                            Sign Up
                        </button>
                    </div>
                </div>
            </header>

            <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                    One platform for every
                    <br />
                    <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                        customer conversation
                    </span>
                </h1>
                <p className="mt-6 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                    CallIQ is a real-time WebRTC contact center: voice and chat, smart routing, live
                    supervisor monitoring, and analytics — all in one workspace for your agents and admins.
                </p>
                <div className="mt-8 flex items-center justify-center gap-3">
                    <button
                        onClick={() => setAuthMode('signup')}
                        className="rounded-lg px-6 py-3 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                    >
                        Get started free
                    </button>
                    <button
                        onClick={() => setAuthMode('login')}
                        className="rounded-lg px-6 py-3 text-sm font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        Log in
                    </button>
                </div>
            </section>

            <section className="max-w-5xl mx-auto px-6 pb-20">
                <p className="text-center text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-6">
                    Trusted by teams like yours
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-slate-400 dark:text-slate-600">
                    {TRUST_MARKS.map((m) => (
                        <div key={m.name} className="flex items-center gap-2 grayscale opacity-70">
                            <m.icon className="h-5 w-5" strokeWidth={1.5} />
                            <span className="font-medium text-sm">{m.name}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section id="features" className="max-w-6xl mx-auto px-6 py-20">
                <h2 className="text-2xl font-semibold text-center mb-2">Everything a modern contact center needs</h2>
                <p className="text-center text-slate-500 dark:text-slate-400 mb-12">
                    Built for teams who take support seriously.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {FEATURES.map((f) => (
                        <div
                            key={f.title}
                            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
                        >
                            <div className="h-11 w-11 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-4">
                                <f.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
                            </div>
                            <h3 className="font-semibold mb-1.5">{f.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{f.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section id="how-it-works" className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
                <div className="max-w-5xl mx-auto px-6 py-20">
                    <h2 className="text-2xl font-semibold text-center mb-12">How it works</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                        {STEPS.map((s) => (
                            <div key={s.step} className="text-center">
                                <div className="text-4xl font-bold text-indigo-500/30 mb-2">{s.step}</div>
                                <h3 className="font-semibold mb-1.5">{s.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{s.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="max-w-4xl mx-auto px-6 py-20 text-center">
                <h2 className="text-2xl font-semibold mb-3">Ready to modernize your contact center?</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                    Create a customer account to try it, or log in if your team already has one.
                </p>
                <button
                    onClick={() => setAuthMode('signup')}
                    className="rounded-lg px-6 py-3 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                >
                    Get started free
                </button>
            </section>

            <footer className="border-t border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span>© {new Date().getFullYear()} CallIQ. All rights reserved.</span>
                    <div className="flex gap-4">
                        <a href="#features" className="hover:text-indigo-500">Features</a>
                        <a href="#how-it-works" className="hover:text-indigo-500">How it works</a>
                    </div>
                </div>
            </footer>

            {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}
        </main>
    );
}
