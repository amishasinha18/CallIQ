'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { api, productImageUrl } from '@/lib/apiClient';

function ProductThumb({ product }) {
    const [failed, setFailed] = useState(false);
    if (!product.image || failed) {
        return (
            <div className="h-12 w-12 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {product.name.charAt(0)}
            </div>
        );
    }
    return (
        <img
            src={productImageUrl(product.id)}
            alt={product.name}
            onError={() => setFailed(true)}
            className="h-12 w-12 rounded-md object-cover shrink-0"
        />
    );
}

export default function ProductsTab() {
    const [products, setProducts] = useState([]);
    const [agents, setAgents] = useState([]);
    const [assignmentsByProduct, setAssignmentsByProduct] = useState({});
    const [form, setForm] = useState({ name: '', description: '', price: '' });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const reload = useCallback(async () => {
        try {
            const [p, a] = await Promise.all([api.get('/products'), api.get('/agents')]);
            setProducts(p);
            setAgents(a);
            const entries = await Promise.all(p.map((prod) => api.get(`/products/${prod.id}/agents`)));
            const map = {};
            p.forEach((prod, i) => (map[prod.id] = entries[i]));
            setAssignmentsByProduct(map);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    function handleImagePick(e) {
        const file = e.target.files[0] || null;
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImageFile(file);
        setImagePreview(file ? URL.createObjectURL(file) : null);
    }

    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function createProduct(e) {
        e.preventDefault();
        try {
            const product = await api.post('/products', { ...form, price: Number(form.price) });
            if (imageFile) {
                await api.postRaw(`/products/${product.id}/image`, imageFile);
            }
            setForm({ name: '', description: '', price: '' });
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setImageFile(null);
            setImagePreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function uploadRowImage(productId, file) {
        try {
            await api.postRaw(`/products/${productId}/image`, file);
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function deleteProduct(id) {
        try {
            await api.del(`/products/${id}`);
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function toggleAssignment(productId, agentId, assigned) {
        try {
            if (assigned) await api.del(`/products/${productId}/assign/${agentId}`);
            else await api.post(`/products/${productId}/assign`, { agentId });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="space-y-6">
            <form onSubmit={createProduct} className="flex flex-wrap gap-2 items-end">
                <input
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    placeholder="Product name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                />
                <input
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm flex-1 min-w-[160px]"
                    placeholder="Description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <input
                    type="number"
                    step="0.01"
                    className="w-28 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    placeholder="Price"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                />
                <label className="flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    {imagePreview ? (
                        <img src={imagePreview} alt="" className="h-6 w-6 rounded object-cover" />
                    ) : (
                        <ImagePlus className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
                    )}
                    <span className="text-slate-500 dark:text-slate-400">{imageFile ? imageFile.name : 'Image'}</span>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                </label>
                <button className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium">
                    Add product
                </button>
            </form>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="space-y-3">
                {products.map((p) => {
                    const assigned = assignmentsByProduct[p.id] || [];
                    const assignedIds = new Set(assigned.map((a) => a.id));
                    return (
                        <div key={p.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <ProductThumb product={p} />
                                    <div className="min-w-0">
                                        <p className="font-medium">{p.name}</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs">
                                            {p.description} · ${Number(p.price).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <label className="text-xs text-indigo-500 hover:underline cursor-pointer">
                                        {p.image ? 'Replace image' : 'Upload image'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) uploadRowImage(p.id, file);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                    <button onClick={() => deleteProduct(p.id)} className="text-red-500 text-xs hover:underline">
                                        Delete
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {agents.map((a) => {
                                    const isAssigned = assignedIds.has(a.id);
                                    return (
                                        <button
                                            key={a.id}
                                            onClick={() => toggleAssignment(p.id, a.id, isAssigned)}
                                            className={`rounded-full px-2.5 py-1 text-xs border ${
                                                isAssigned
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'border-slate-300 dark:border-slate-700'
                                            }`}
                                        >
                                            {a.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
