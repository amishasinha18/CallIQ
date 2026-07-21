'use client';

import { Star } from 'lucide-react';

/** Shared star display — interactive (pass onChange) or read-only (omit it). */
export default function StarRating({ value, onChange, size = 'h-5 w-5', max = 5 }) {
    const interactive = !!onChange;
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <button
                    key={n}
                    type="button"
                    disabled={!interactive}
                    onClick={interactive ? () => onChange(n) : undefined}
                    className={interactive ? 'cursor-pointer' : 'cursor-default'}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                >
                    <Star
                        className={`${size} ${
                            n <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-700'
                        }`}
                        strokeWidth={1.5}
                    />
                </button>
            ))}
        </div>
    );
}
