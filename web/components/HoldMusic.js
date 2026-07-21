'use client';

import { useEffect, useRef, useState } from 'react';
import { Music } from 'lucide-react';

const DURATION_MS = 8000;

/** No agent was available — plays a simple hold tone, then calls onDone (which hangs up / resets). */
export default function HoldMusic({ onDone }) {
    const [secondsLeft, setSecondsLeft] = useState(Math.ceil(DURATION_MS / 1000));
    const ctxRef = useRef(null);

    useEffect(() => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        ctxRef.current = ctx;

        const gain = ctx.createGain();
        gain.gain.value = 0.05;
        gain.connect(ctx.destination);

        // Two gently alternating tones — a generic "on hold" chime loop, not a real music asset.
        const notes = [523.25, 659.25]; // C5, E5
        let noteIndex = 0;
        let oscillator = null;

        function playNote() {
            if (oscillator) oscillator.stop();
            oscillator = ctx.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = notes[noteIndex % notes.length];
            oscillator.connect(gain);
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.35);
            noteIndex += 1;
        }

        playNote();
        const noteInterval = setInterval(playNote, 600);
        const countdownInterval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
        const doneTimeout = setTimeout(() => {
            clearInterval(noteInterval);
            clearInterval(countdownInterval);
            ctx.close();
            onDone();
        }, DURATION_MS);

        return () => {
            clearInterval(noteInterval);
            clearInterval(countdownInterval);
            clearTimeout(doneTimeout);
            if (ctx.state !== 'closed') ctx.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 max-w-sm w-full text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center animate-pulse">
                <Music className="h-5 w-5 text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
            </div>
            <h2 className="text-lg font-semibold">All agents are busy</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Please hold — we'll disconnect and you can try again shortly.
            </p>
            <div className="text-2xl font-bold text-indigo-500">{secondsLeft}s</div>
        </div>
    );
}
