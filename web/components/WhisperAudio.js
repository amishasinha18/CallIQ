'use client';

import { useEffect } from 'react';
import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant } from '@livekit/components-react';
import { Headphones } from 'lucide-react';
import { useCallStore } from '@/lib/store/callStore';

/** Shows the "supervisor whispering" badge only while the server has an active whisper live. */
function WhisperBadge({ active }) {
    if (!active) return null;
    return (
        <div className="fixed bottom-4 left-4 z-[60] flex items-center gap-1.5 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
            <Headphones className="h-3.5 w-3.5" strokeWidth={2} />
            Supervisor whispering
        </div>
    );
}

/**
 * The agent's whisper-room mic is only ever unmutable server-side while a
 * whisper is actually active (see setAgentWhisperPublish) — this just keeps
 * the client's own mic state in sync with that window so the agent can
 * actually talk back to the admin while it's open, and stays silent otherwise.
 */
function WhisperMicGate({ active }) {
    const { localParticipant } = useLocalParticipant();
    useEffect(() => {
        localParticipant?.setMicrophoneEnabled(active);
    }, [active, localParticipant]);
    return null;
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
    const whisperActive = useCallStore((s) => s.whisperActive);
    if (!whisper) return null;

    return (
        <>
            {/* `display: none` on this wrapper hides its whole subtree regardless of any
                descendant's own `position`, so the badge below must live outside it. */}
            <LiveKitRoom serverUrl={whisper.livekitUrl} token={whisper.token} connect video={false} audio={false} style={{ display: 'none' }}>
                <RoomAudioRenderer />
                <WhisperMicGate active={whisperActive} />
            </LiveKitRoom>
            <WhisperBadge active={whisperActive} />
        </>
    );
}
