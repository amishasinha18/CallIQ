'use client';

import { useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { useAuthStore } from '@/lib/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Mounted only in the agent's call view (one recorder per call, not two).
 * Mixes the agent's own mic with every remote participant's audio into one
 * track via Web Audio, records it, and uploads the result when the call ends.
 */
export default function CallRecorder({ callId }) {
    const room = useRoomContext();
    const token = useAuthStore((s) => s.token);
    const chunksRef = useRef([]);

    useEffect(() => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        const dest = audioCtx.createMediaStreamDestination();
        const sources = [];

        function connectTrack(track) {
            if (!track || track.kind !== 'audio' || !track.mediaStreamTrack) return;
            try {
                const src = audioCtx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
                src.connect(dest);
                sources.push(src);
            } catch {
                // Track already ended/detached — safe to skip.
            }
        }

        room.localParticipant.audioTrackPublications.forEach((pub) => connectTrack(pub.track));
        room.remoteParticipants.forEach((p) => p.audioTrackPublications.forEach((pub) => connectTrack(pub.track)));

        const onTrackSubscribed = (track) => connectTrack(track);
        const onLocalPublished = (pub) => connectTrack(pub.track);
        room.on('trackSubscribed', onTrackSubscribed);
        room.on('localTrackPublished', onLocalPublished);

        chunksRef.current = [];
        const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(1000);

        return () => {
            room.off('trackSubscribed', onTrackSubscribed);
            room.off('localTrackPublished', onLocalPublished);

            if (recorder.state !== 'inactive') {
                recorder.onstop = async () => {
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    if (blob.size > 0) {
                        try {
                            await fetch(`${API_URL}/calls/${callId}/recording`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'audio/webm', Authorization: `Bearer ${token}` },
                                body: blob,
                            });
                        } catch {
                            // Best-effort — a failed upload shouldn't block call teardown.
                        }
                    }
                };
                recorder.stop();
            }
            sources.forEach((s) => s.disconnect());
            if (audioCtx.state !== 'closed') audioCtx.close();
        };
    }, [room, callId, token]);

    return null;
}
