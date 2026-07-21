'use client';

import { io } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

let socket = null;

/**
 * One shared socket per authenticated session; call disconnectSocket() on logout.
 * Reuse it once created regardless of `.connected` — it's normal for that to be
 * false during the initial handshake, and socket.io reconnects on its own.
 * Multiple hooks (useCallSocket, useChatSocket) call this independently, so
 * recreating on every not-yet-connected check would tear down and replace the
 * in-flight socket mid-handshake, leaving other hooks holding a dead reference.
 */
export function getSocket(token) {
    if (socket) return socket;
    socket = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
    });
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
