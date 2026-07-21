'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from './store/authStore';
import { useCallStore } from './store/callStore';
import { getSocket } from './socketClient';

/** Wires the shared socket.io call-signaling events into callStore. Used by both the customer and agent portals. */
export function useCallSocket() {
    const token = useAuthStore((s) => s.token);
    const socketRef = useRef(null);
    const store = useCallStore;

    useEffect(() => {
        if (!token) return;
        const socket = getSocket(token);
        socketRef.current = socket;

        const onWaiting = (payload) => store.getState().setWaiting(payload);
        const onIncoming = (payload) => store.getState().setIncoming(payload);
        const onNoAgentAvailable = (payload) => store.getState().setNoAgentAvailable(payload);
        const onConnected = (payload) => store.getState().setConnected(payload);
        const onEnded = ({ endedBy }) => store.getState().setEnded(endedBy);
        const onDeclined = () => store.getState().reset();
        const onError = (e) => console.error('[call:error]', e.message);
        const onSupervisorJoined = () => store.getState().setSupervisorJoined();
        const onSupervisorLeft = () => store.getState().setSupervisorLeft();
        const onWhisperStart = (payload) => store.getState().setWhisper(payload);
        const onWhisperActive = (payload) => store.getState().setWhisperActive(payload.active);
        const onHoldStart = () => store.getState().setOnHold(true);
        const onHoldEnd = () => store.getState().setOnHold(false);

        socket.on('call:ringing', onWaiting);
        socket.on('call:incoming', onIncoming);
        socket.on('call:noAgentAvailable', onNoAgentAvailable);
        socket.on('call:connected', onConnected);
        socket.on('call:ended', onEnded);
        socket.on('call:declined', onDeclined);
        socket.on('call:error', onError);
        socket.on('call:supervisorJoined', onSupervisorJoined);
        socket.on('call:supervisorLeft', onSupervisorLeft);
        socket.on('call:whisperStart', onWhisperStart);
        socket.on('call:whisperActive', onWhisperActive);
        socket.on('call:holdStart', onHoldStart);
        socket.on('call:holdEnd', onHoldEnd);

        return () => {
            socket.off('call:ringing', onWaiting);
            socket.off('call:incoming', onIncoming);
            socket.off('call:noAgentAvailable', onNoAgentAvailable);
            socket.off('call:connected', onConnected);
            socket.off('call:ended', onEnded);
            socket.off('call:declined', onDeclined);
            socket.off('call:error', onError);
            socket.off('call:supervisorJoined', onSupervisorJoined);
            socket.off('call:supervisorLeft', onSupervisorLeft);
            socket.off('call:whisperStart', onWhisperStart);
            socket.off('call:whisperActive', onWhisperActive);
            socket.off('call:holdStart', onHoldStart);
            socket.off('call:holdEnd', onHoldEnd);
        };
    }, [token]);

    return socketRef;
}
