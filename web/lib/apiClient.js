'use client';

import { useAuthStore } from './store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function request(method, path, body) {
    const token = useAuthStore.getState().token;
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
        throw new Error(data?.error || `Request failed: ${res.status}`);
    }
    return data;
}

/** Raw binary upload (e.g. an image File) — the JSON-only `request()` above can't send this. */
async function requestRaw(path, file) {
    const token = useAuthStore.getState().token;
    const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': file.type,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
        throw new Error(data?.error || `Request failed: ${res.status}`);
    }
    return data;
}

export const api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
    postRaw: (path, file) => requestRaw(path, file),
};

export const API_BASE_URL = API_URL;

export const productImageUrl = (productId) => `${API_URL}/products/${productId}/image`;
