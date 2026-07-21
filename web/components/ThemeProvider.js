'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/store/themeStore';

export default function ThemeProvider({ children }) {
    const theme = useThemeStore((s) => s.theme);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    return children;
}
