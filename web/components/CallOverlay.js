'use client';

import { useEffect, useRef } from 'react';
import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant } from '@livekit/components-react';
import { Phone, PhoneIncoming } from 'lucide-react';
import { useCallStore } from '@/lib/store/callStore';
import HoldMusic from './HoldMusic';
import CallRecorder from './CallRecorder';
import CallStage from './CallStage';
import OnHoldOverlay from './OnHoldOverlay';

/**
 * Forces the main-room mic off while `muted` is true (agent: while an admin
 * is whispering; customer: while on hold) and restores whatever it was
 * before once `muted` goes back to false — not a blind force-true, so a
 * pre-existing manual mute survives the round trip.
 */
function AutoMicGate({ muted }) {
    const { localParticipant } = useLocalParticipant();
    const prevEnabledRef = useRef(true);
    useEffect(() => {
        if (!localParticipant) return;
        if (muted) {
            prevEnabledRef.current = localParticipant.isMicrophoneEnabled;
            localParticipant.setMicrophoneEnabled(false);
        } else {
            localParticipant.setMicrophoneEnabled(prevEnabledRef.current);
        }
    }, [muted, localParticipant]);
    return null;
}

/**
 * Full-screen overlay covering every non-idle call state: waiting on the
 * other party, an actionable incoming ring, the no-agent-available hold
 * music, and the live LiveKit video call itself. Shared by the customer and
 * agent portals — `role` only changes copy/labels and whether a recorder
 * is mounted, not the core behavior.
 */
export default function CallOverlay({ socket, role }) {
    const { status, waiting, incoming, noAgent, room, token, livekitUrl, supervisorJoined, callId, reset } =
        useCallStore();
    const whisperActive = useCallStore((s) => s.whisperActive);
    const onHold = useCallStore((s) => s.onHold);
    const muted = role === 'agent' ? whisperActive : onHold;

    if (status === 'idle') return null;

    if (status === 'ended') {
        return null; // agent page swaps this for the disposition modal; customer page just clears it
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
            {status === 'noAgent' && noAgent && <HoldMusic onDone={reset} />}

            {status === 'ringing' && waiting && (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-8 max-w-sm w-full text-center space-y-3">
                    <div className="mx-auto h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center animate-pulse">
                        <Phone className="h-5 w-5 text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
                    </div>
                    <h2 className="text-lg font-semibold">
                        {role === 'agent' ? 'Ringing customer…' : 'Connecting you to an agent…'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {waiting.productName}
                        {waiting.customerName ? ` — ${waiting.customerName}` : ''}
                    </p>
                </div>
            )}

            {status === 'ringing' && incoming && (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-8 max-w-sm w-full text-center space-y-3">
                    <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                        <PhoneIncoming className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                    </div>
                    <h2 className="text-lg font-semibold">Incoming call</h2>
                    <p className="text-sm">
                        <span className="font-medium">{incoming.customerName || incoming.agentName}</span>
                        {incoming.productName ? ` — ${incoming.productName}` : ''}
                    </p>
                    <div className="flex gap-3 justify-center pt-2">
                        <button
                            onClick={() => socket.emit('call:accept', { callId: incoming.callId })}
                            className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-medium"
                        >
                            Accept
                        </button>
                        <button
                            onClick={() => socket.emit('call:reject', { callId: incoming.callId })}
                            className="rounded-md bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-sm font-medium"
                        >
                            Decline
                        </button>
                    </div>
                </div>
            )}

            {status === 'connected' && token && (
                <div className="w-full h-full max-w-5xl max-h-[85vh] bg-slate-950 rounded-2xl overflow-hidden flex flex-col shadow-2xl ring-1 ring-white/10">
                    {supervisorJoined && (
                        <div className="bg-amber-500/90 text-white text-center text-xs py-1">
                            A supervisor has joined this call
                        </div>
                    )}
                    <div className="flex-1 relative">
                        <LiveKitRoom
                            serverUrl={livekitUrl}
                            token={token}
                            connect
                            video
                            audio
                            data-lk-theme="default"
                            style={{ height: '100%' }}
                            onDisconnected={() => {}}
                        >
                            <CallStage micDisabled={muted} />
                            <RoomAudioRenderer />
                            <AutoMicGate muted={muted} />
                            {role === 'agent' && <CallRecorder callId={callId} />}
                        </LiveKitRoom>
                        {role === 'customer' && onHold && <OnHoldOverlay />}
                    </div>
                    <div className="p-3 bg-slate-900 flex justify-center">
                        <button
                            onClick={() => socket.emit('call:hangup', { callId })}
                            className="rounded-md bg-red-600 hover:bg-red-500 text-white px-5 py-2 text-sm font-medium"
                        >
                            Hang up
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
