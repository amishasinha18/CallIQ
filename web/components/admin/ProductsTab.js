'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export default function ProductsTab() {
    const [products, setProducts] = useState([]);
    const [agents, setAgents] = useState([]);
    const [assignmentsByProduct, setAssignmentsByProduct] = useState({});
    const [form, setForm] = useState({ name: '', description: '', price: '' });
    const [error, setError] = useState('');

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

    async function createProduct(e) {
        e.preventDefault();
        try {
            await api.post('/products', { ...form, price: Number(form.price) });
            setForm({ name: '', description: '', price: '' });
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
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{p.name}</p>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                                        {p.description} · ${Number(p.price).toFixed(2)}
                                    </p>
                                </div>
                                <button onClick={() => deleteProduct(p.id)} className="text-red-500 text-xs hover:underline">
                                    Delete
                                </button>
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
