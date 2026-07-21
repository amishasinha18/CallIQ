'use client';

import { useEffect } from 'react';

/**
 * Loops a couple of alternating sine-wave notes via the Web Audio API — a
 * generic "on hold" chime, not a licensed music asset. Shared by HoldMusic
 * (fixed-duration, auto-hangs-up) and OnHoldOverlay (indefinite, mounted for
 * as long as the caller says so) since their lifecycles differ but the tone
 * itself doesn't.
 */
export function useToneLoop(active) {
    useEffect(() => {
        if (!active) return undefined;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const gain = ctx.createGain();
        gain.gain.value = 0.05;
        gain.connect(ctx.destination);

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

        return () => {
            clearInterval(noteInterval);
            if (ctx.state !== 'closed') ctx.close();
        };
    }, [active]);
}
