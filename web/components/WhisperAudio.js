'use client';

import { LiveKitRoom, RoomAudioRenderer, useRemoteParticipants } from '@livekit/components-react';
import { Headphones } from 'lucide-react';
import { useCallStore } from '@/lib/store/callStore';

/** Shows the "supervisor whispering" badge only once an admin has actually joined the room. */
function WhisperBadge() {
    const remoteParticipants = useRemoteParticipants();
    if (remoteParticipants.length === 0) return null;
    return (
        <div className="fixed bottom-4 left-4 z-[60] flex items-center gap-1.5 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
            <Headphones className="h-3.5 w-3.5" strokeWidth={2} />
            Supervisor whispering
        </div>
    );
}

/**
 * Agent-side: joins a second, invisible LiveKit room the moment the call
 * connects — silently, with nobody else in it — so that if an admin later
 * whispers, they're joining a room with a long-established participant
 * instead of racing a simultaneous two-party join (which was silently
 * dropping the very first whisper track, see livekitService.js). No video
 * UI, and the customer's connection never knows this room exists.
 */
export default function WhisperAudio() {
    const whisper = useCallStore((s) => s.whisper);
    if (!whisper) return null;

    return (
        <LiveKitRoom serverUrl={whisper.livekitUrl} token={whisper.token} connect video={false} audio={false} style={{ display: 'none' }}>
            <RoomAudioRenderer />
            <WhisperBadge />
        </LiveKitRoom>
    );
}
