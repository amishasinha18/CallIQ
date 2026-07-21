'use client';

import { useState } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { productImageUrl } from '@/lib/apiClient';

export default function ProductCard({ product, onTalkToAgent, onStartChat, disabled, canChat }) {
    const [imgFailed, setImgFailed] = useState(false);
    const showImage = product.image && !imgFailed;

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
            {showImage ? (
                <img
                    src={productImageUrl(product.id)}
                    alt={product.name}
                    onError={() => setImgFailed(true)}
                    className="h-32 w-full rounded-lg object-cover"
                />
            ) : (
                <div className="h-32 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-semibold">
                    {product.name.charAt(0)}
                </div>
            )}
            <h3 className="font-semibold">{product.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex-1">{product.description}</p>
            <p className="text-lg font-semibold">${Number(product.price).toFixed(2)}</p>
            <div className="flex gap-2">
                <button
                    onClick={() => onTalkToAgent(product)}
                    disabled={disabled}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 text-sm font-medium transition-colors"
                >
                    <Phone className="h-4 w-4" strokeWidth={2} />
                    Call
                </button>
                {/* Visibility Check: hidden entirely unless at least one assigned agent is online. */}
                {canChat && (
                    <button
                        onClick={() => onStartChat(product)}
                        disabled={disabled}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-2 text-sm font-medium transition-colors"
                    >
                        <MessageCircle className="h-4 w-4" strokeWidth={2} />
                        Text
                    </button>
                )}
            </div>
        </div>
    );
}
