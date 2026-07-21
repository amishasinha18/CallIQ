'use client';

import { create } from 'zustand';

const initialState = {
    status: 'idle', // idle | ringing | connected | noAgent | ended
    callId: null,
    direction: null, // inbound | outbound
    room: null,
    token: null,
    livekitUrl: null,
    // I am the caller, waiting for the other party to accept — no action available.
    waiting: null, // { callId, productName } | { callId, productName, customerName }
    // The other party is calling ME — Accept/Reject buttons shown.
    incoming: null, // { callId, customerName, productName } (agent) | { callId, agentName, productName, outbound } (customer)
    // Nobody was available to take the call — hold music plays, then it hangs up on its own.
    noAgent: null, // { callId, productName }
    whisper: null, // { room, token } — agent only, standby whisper-room connection joined at call-connect
    whisperActive: false, // agent only — true only while an admin's whisper is actually live
    onHold: false, // customer only — true while an admin is whispering to the agent
    supervisorJoined: false,
    lastEndedBy: null,
};

export const useCallStore = create((set) => ({
    ...initialState,

    setWaiting: (payload) => set({ status: 'ringing', waiting: payload, incoming: null, noAgent: null }),
    setIncoming: (payload) => set({ status: 'ringing', incoming: payload, waiting: null, noAgent: null }),
    setNoAgentAvailable: (payload) => set({ status: 'noAgent', noAgent: payload, waiting: null, incoming: null }),
    setConnected: (payload) =>
        set({
            status: 'connected',
            callId: payload.callId,
            room: payload.room,
            token: payload.token,
            livekitUrl: payload.livekitUrl,
        }),
    // Keep callId around — the agent portal needs it to submit the mandatory disposition.
    // Everything else about the finished session (room/token/whisper/etc.) is stale, so clear it.
    setEnded: (endedBy) =>
        set((state) => ({
            ...initialState,
            status: 'ended',
            callId: state.callId,
            lastEndedBy: endedBy,
        })),
    setWhisper: (payload) => set({ whisper: payload }),
    setWhisperActive: (active) => set({ whisperActive: active }),
    setOnHold: (onHold) => set({ onHold }),
    setSupervisorJoined: () => set({ supervisorJoined: true }),
    setSupervisorLeft: () => set({ supervisorJoined: false }),
    reset: () => set(initialState),
}));
