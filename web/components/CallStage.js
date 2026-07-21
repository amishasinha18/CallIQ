'use client';

import { useEffect, useState } from 'react';
import { GridLayout, ParticipantTile, ControlBar, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0');
    const s = Math.floor(seconds % 60)
        .toString()
        .padStart(2, '0');
    return `${m}:${s}`;
}

/** Live call duration, ticking from the moment this mounts (i.e. from connect). */
function CallTimer() {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, []);
    return <span className="font-mono text-xs text-slate-300">{formatDuration(seconds)}</span>;
}

/**
 * Custom call layout replacing LiveKit's all-in-one <VideoConference/> —
 * that component ships its own built-in Chat button, which is redundant
 * (and confusing) next to our own chat system, and there's no prop to
 * simply turn it off short of building the layout by hand.
 */
export default function CallStage() {
    const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false });

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80">
                <span className="text-xs text-slate-400">Live call</span>
                <CallTimer />
            </div>
            <GridLayout tracks={tracks} style={{ height: 'calc(100% - 118px)' }} className="px-2 pt-2">
                <ParticipantTile className="rounded-xl overflow-hidden" />
            </GridLayout>
            <div className="py-2 flex justify-center">
                <ControlBar controls={{ chat: false, leave: false, settings: false }} variation="minimal" />
            </div>
        </div>
    );
}
