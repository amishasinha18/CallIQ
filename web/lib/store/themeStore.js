'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
    persist(
        (set, get) => ({
            theme: 'light',
            toggle: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
        }),
        { name: 'cc-theme' }
    )
);
