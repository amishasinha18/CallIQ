'use client';

import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/lib/store/themeStore';

export default function ThemeToggle() {
    const { theme, toggle } = useThemeStore();
    return (
        <button
            onClick={toggle}
            className="rounded-full border border-slate-300 dark:border-slate-700 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
    );
}
