'use client';

import { Headphones } from 'lucide-react';
import { useToneLoop } from '@/lib/useToneLoop';

/**
 * Customer-side: shown for as long as an admin is whispering to the agent.
 * Unlike HoldMusic (fixed duration, auto-hangs-up), this has no timer — it's
 * mounted/unmounted purely by the server-driven `onHold` flag and clears the
 * instant the admin closes their whisper.
 */
export default function OnHoldOverlay() {
    useToneLoop(true);

    return (
        <div className="absolute inset-0 z-10 bg-slate-950/95 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 max-w-sm w-full text-center space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center animate-pulse">
                    <Headphones className="h-5 w-5 text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
                </div>
                <h2 className="text-lg font-semibold">You're on hold</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Please hold for a moment — the agent will be right back with you.
                </p>
            </div>
        </div>
    );
}
