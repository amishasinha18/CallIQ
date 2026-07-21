'use client';

import { useAuthStore } from './store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Authenticated GET → blob → trigger a browser download (auth headers can't go on a plain <a href>). */
export async function downloadFile(path, filename) {
    const token = useAuthStore.getState().token;
    const res = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
