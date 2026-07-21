'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { getSocket } from './socketClient';
import { api } from './apiClient';

/** Admin Live Calls tab: seeds from REST, then stays current via the 'call:updated' socket event. */
export function useLiveCalls() {
    const token = useAuthStore((s) => s.token);
    const [calls, setCalls] = useState([]);

    useEffect(() => {
        if (!token) return;
        api.get('/calls/live').then(setCalls).catch(() => {});

        const socket = getSocket(token);
        const onUpdated = (session) => {
            setCalls((prev) => {
                if (session.status === 'ended') return prev.filter((c) => c.id !== session.id);
                const idx = prev.findIndex((c) => c.id === session.id);
                if (idx === -1) return [...prev, session];
                const next = [...prev];
                next[idx] = session;
                return next;
            });
        };
        socket.on('call:updated', onUpdated);
        return () => socket.off('call:updated', onUpdated);
    }, [token]);

    return calls;
}
