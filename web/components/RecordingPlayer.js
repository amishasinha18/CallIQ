'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Fetches a call recording with the auth header attached, then plays it as a blob URL. */
export default function RecordingPlayer({ callId, hasRecording }) {
    const token = useAuthStore((s) => s.token);
    const [src, setSrc] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!hasRecording) return;
        let objectUrl;
        fetch(`${API_URL}/calls/${callId}/recording`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => {
                if (!res.ok) throw new Error('not found');
                return res.blob();
            })
            .then((blob) => {
                objectUrl = URL.createObjectURL(blob);
                setSrc(objectUrl);
            })
            .catch(() => setError(true));

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [callId, hasRecording, token]);

    if (!hasRecording) return <p className="text-xs text-slate-400">No recording available.</p>;
    if (error) return <p className="text-xs text-red-500">Recording failed to load.</p>;
    if (!src) return <p className="text-xs text-slate-400">Loading recording…</p>;

    return <audio controls src={src} className="w-full h-9" />;
}
