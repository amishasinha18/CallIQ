'use client';

import { useState } from 'react';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import { api } from '@/lib/apiClient';

const COPY = {
    listen: 'Listening silently — neither party can see or hear you.',
    whisper: 'Whispering — the customer is on hold and only the agent can hear you.',
    barge: "You've joined as a third participant — visible to both parties.",
};

export default function MonitorModal({ session, onClose }) {
    const [closing, setClosing] = useState(false);
    if (!session) return null;
    const { mode, callId, room, token, livekitUrl } = session;

    async function handleClose() {
        setClosing(true);
        if (mode === 'whisper' || mode === 'barge') {
            // Puts the call's visuals back to normal (ends the hold / clears the
            // "supervisor joined" banner) — swallow errors, closing the modal must
            // never get stuck on a failed network call.
            try {
                await api.post(`/calls/${callId}/monitor/stop`, { mode });
            } catch {
                // best-effort
            }
        }
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
            <div className="w-full h-full max-w-4xl max-h-[85vh] bg-black rounded-xl overflow-hidden flex flex-col">
                <div className="bg-slate-900 text-white text-sm px-4 py-2 flex items-center justify-between">
                    <span className="capitalize font-medium">{mode}</span>
                    <button
                        onClick={handleClose}
                        disabled={closing}
                        className="rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-50 px-3 py-1 text-xs"
                    >
                        {closing ? 'Closing…' : 'Close'}
                    </button>
                </div>
                <p className="bg-slate-800 text-slate-300 text-xs px-4 py-1.5">{COPY[mode]}</p>
                <div className="flex-1 relative">
                    <LiveKitRoom
                        serverUrl={livekitUrl}
                        token={token}
                        connect
                        video={mode === 'barge'}
                        audio={mode === 'barge' || mode === 'whisper'}
                        data-lk-theme="default"
                        style={{ height: '100%' }}
                    >
                        {mode === 'barge' ? <VideoConference /> : null}
                        <RoomAudioRenderer />
                    </LiveKitRoom>
                </div>
            </div>
        </div>
    );
}
