'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/store/authStore';

export default function AuthModal({ mode: initialMode, onClose }) {
    const router = useRouter();
    const { login } = useAuthStore();
    const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result =
                mode === 'signup'
                    ? await api.post('/auth/signup', form)
                    : await api.post('/auth/login', { email: form.email, password: form.password });
            login(result.token, result.user);
            router.push(`/${result.user.role}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xl font-semibold">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">
                        ×
                    </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                    {mode === 'signup' ? 'Start talking to your customers in minutes.' : 'Sign in to your CallIQ workspace.'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {mode === 'signup' && (
                        <input
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                            placeholder="Full name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    )}
                    <input
                        type="email"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        placeholder="Email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                    />
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 pr-10 text-sm"
                            placeholder="Password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                        </button>
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
                    </button>
                </form>

                <p className="text-center text-sm mt-4 text-slate-500 dark:text-slate-400">
                    {mode === 'login' ? (
                        <>
                            New to CallIQ?{' '}
                            <button className="text-indigo-500 hover:underline" onClick={() => setMode('signup')}>
                                Create an account
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button className="text-indigo-500 hover:underline" onClick={() => setMode('login')}>
                                Log in
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
