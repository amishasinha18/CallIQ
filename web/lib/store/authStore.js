'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
    persist(
        (set) => ({
            token: null,
            user: null, // { id, name, email, role, ... }
            login: (token, user) => set({ token, user }),
            logout: () => set({ token: null, user: null }),
        }),
        { name: 'cc-auth' }
    )
);
