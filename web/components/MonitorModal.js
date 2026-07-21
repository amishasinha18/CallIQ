'use client';

import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';

const COPY = {
    listen: 'Listening silently — neither party can see or hear you.',
    whisper: 'Whispering — only the agent can hear you.',
    barge: "You've joined as a third participant — visible to both parties.",
};

export default function MonitorModal({ session, onClose }) {
    if (!session) return null;
    const { mode, room, token, livekitUrl } = session;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
            <div className="w-full h-full max-w-4xl max-h-[85vh] bg-black rounded-xl overflow-hidden flex flex-col">
                <div className="bg-slate-900 text-white text-sm px-4 py-2 flex items-center justify-between">
                    <span className="capitalize font-medium">{mode}</span>
                    <button onClick={onClose} className="rounded-md bg-red-600 hover:bg-red-500 px-3 py-1 text-xs">
                        Close
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
