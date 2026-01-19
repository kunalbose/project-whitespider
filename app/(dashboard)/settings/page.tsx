'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Trash2, Copy, Plus, Loader2 } from 'lucide-react';

interface ApiKey {
    id: number;
    created_at: string;
    key_hash: string;
    status: string;
}

export default function SettingsPage() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);

    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        try {
            const res = await fetch('/api/settings/api-keys');
            if (res.ok) {
                const data = await res.json();
                setKeys(data);
            } else {
                toast.error('Failed to fetch API keys');
            }
        } catch (error) {
            toast.error('Error fetching keys');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/settings/api-keys', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setNewKey(data.secret_key);
                toast.success('API Key generated successfully');
                fetchKeys();
            } else {
                toast.error('Failed to generate key');
            }
        } catch (error) {
            toast.error('Error generating key');
        } finally {
            setGenerating(false);
        }
    };

    const handleRevoke = async (id: number) => {
        if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;

        try {
            const res = await fetch(`/api/settings/api-keys?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('API Key revoked');
                setKeys(keys.filter(k => k.id !== id));
            } else {
                toast.error('Failed to revoke key');
            }
        } catch (error) {
            toast.error('Error revoking key');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-white">Settings</h1>

            {/* Tabs (Visual only for now since we only have one section) */}
            <div className="flex space-x-6 border-b border-gray-800 mb-8">
                <button className="pb-4 border-b-2 border-purple-500 text-purple-400 font-medium">
                    API Keys
                </button>
                {/* <button className="pb-4 text-gray-400 hover:text-gray-300">General</button> */}
            </div>

            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-white">Your API Keys</h2>
                        <p className="text-gray-400 text-sm mt-1">
                            Manage keys for accessing the API via 3rd party tools like Clay or n8n.
                        </p>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        <span>Generate New Key</span>
                    </button>
                </div>

                {newKey && (
                    <div className="mb-6 bg-purple-900/20 border border-purple-500/50 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-purple-400 font-medium mb-2">New API Key Generated</h3>
                                <p className="text-gray-300 text-sm mb-3">
                                    Please copy this key now. You won't be able to see it again!
                                </p>
                                <div className="flex items-center space-x-2 bg-black/50 p-2 rounded border border-purple-500/30">
                                    <code className="text-white font-mono text-sm">{newKey}</code>
                                    <button
                                        onClick={() => copyToClipboard(newKey)}
                                        className="text-gray-400 hover:text-white p-1"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setNewKey(null)}
                                className="text-gray-400 hover:text-white text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                        </div>
                    ) : keys.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No API keys found. Generate one to get started.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-gray-800">
                            <table className="w-full text-left text-sm text-gray-400">
                                <thead className="bg-gray-800 text-gray-200">
                                    <tr>
                                        <th className="px-4 py-3">ID</th>
                                        <th className="px-4 py-3">Created</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 bg-gray-900">
                                    {keys.map((key) => (
                                        <tr key={key.id} className="hover:bg-gray-800/50">
                                            <td className="px-4 py-3 font-mono text-white">{key.id}</td>
                                            <td className="px-4 py-3">
                                                {new Date(key.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${key.status === 'active'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                    {key.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleRevoke(key.id)}
                                                    className="text-red-400 hover:text-red-300 transition-colors p-1"
                                                    title="Revoke Key"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
