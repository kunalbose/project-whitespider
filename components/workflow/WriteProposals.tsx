'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Proposal = {
    id: number;
    list_lead_id: number;
    target: string;
    column_name: string;
    column_raw_name: string | null;
    previous_value: any;
    new_value: any;
    is_new_column: boolean;
    status: 'proposed' | 'applied' | 'discarded' | 'reverted' | 'skipped';
};

const TARGET_LABELS: Record<string, string> = {
    schema: 'native',
    extra_field: 'extra field',
    internal_enrichment: 'internal',
    external_enrichment: 'external',
};

const STATUS_STYLES: Record<string, string> = {
    proposed: 'text-amber-400',
    applied: 'text-green-400',
    discarded: 'text-slate-500',
    reverted: 'text-slate-500',
    skipped: 'text-slate-500',
};

/** Renders a value the way it will actually be stored — empty is meaningfully different from "". */
function display(value: any) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    if (value === '') return '(empty)';
    return String(value);
}

/**
 * The approval step. A test run stages its writes rather than performing them, so this
 * shows the real before/after for every row and commits only when the user says so.
 */
export default function WriteProposals({ executionId }: { executionId: string }) {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            const res = await fetch(`/api/views/workflows/executions/${executionId}/proposals`);
            const data = await res.json();
            if (!cancelled) {
                const rows: Proposal[] = data.data ?? [];
                setProposals(rows);
                // A run waiting on approval is the whole point of this screen — open to it
                // rather than making the user find the drawer. Settled runs stay collapsed.
                setOpen(rows.some((p) => p.status === 'proposed'));
                setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [executionId]);

    async function act(action: 'apply' | 'discard' | 'revert') {
        setBusy(true);
        const toastId = toast.loading(
            action === 'apply' ? 'Applying changes…' : action === 'revert' ? 'Reverting…' : 'Discarding…'
        );

        try {
            const res = await fetch(`/api/views/workflows/executions/${executionId}/proposals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            const data = await res.json();

            if (!data.success) {
                toast.error(data.error || 'Action failed', { id: toastId });
                return;
            }

            const r = data.result;
            if (action === 'apply') {
                toast[r.failed > 0 ? 'warning' : 'success'](
                    `Applied ${r.applied}${r.failed > 0 ? `, ${r.failed} failed` : ''}`,
                    { id: toastId }
                );
            } else if (action === 'revert') {
                toast.success(`Reverted ${r.reverted}`, { id: toastId });
            } else {
                toast.success(`Discarded ${r.discarded}`, { id: toastId });
            }

            const refreshed = await fetch(`/api/views/workflows/executions/${executionId}/proposals`);
            setProposals((await refreshed.json()).data ?? []);
        } catch {
            toast.error('Action failed', { id: toastId });
        } finally {
            setBusy(false);
        }
    }

    // Both of these are already a single strip tall, so there is nothing to collapse.
    if (loading) {
        return (
            <div className="shrink-0 border-t border-slate-700 bg-slate-900/60 px-4 py-3 text-xs text-slate-500">
                Loading changes…
            </div>
        );
    }

    if (proposals.length === 0) {
        return (
            <div className="shrink-0 border-t border-slate-700 bg-slate-900/60 px-4 py-3 text-xs text-slate-500">
                This run did not stage any column changes.
            </div>
        );
    }

    const pending = proposals.filter((p) => p.status === 'proposed').length;
    const applied = proposals.filter((p) => p.status === 'applied').length;

    return (
        <div className="shrink-0 flex flex-col max-h-[45%] border-t border-slate-700 bg-slate-900/60">
            <div
                className={`flex items-center justify-between px-4 py-3 shrink-0 ${open ? 'border-b border-slate-800' : ''}`}
            >
                {/* The always-visible strip: the drawer's handle, and the only thing on screen
                    while collapsed. The action buttons stay outside it so they stay clickable. */}
                <button
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    className="flex items-center gap-2 text-left cursor-pointer group"
                >
                    <span
                        className={`text-[9px] text-slate-500 group-hover:text-slate-300 transition-transform ${open ? '' : '-rotate-90'}`}
                    >
                        ▼
                    </span>
                    <span>
                        <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300">
                            Proposed changes
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                            {pending > 0
                                ? `${pending} staged — nothing written to the list yet`
                                : applied > 0
                                    ? `${applied} applied to the list`
                                    : 'Nothing pending'}
                        </span>
                    </span>
                </button>

                <div className="flex gap-2">
                    {pending > 0 && (
                        <>
                            <button
                                disabled={busy}
                                onClick={() => act('apply')}
                                className="px-3 py-1.5 rounded text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white cursor-pointer transition-colors"
                            >
                                Approve {pending}
                            </button>
                            <button
                                disabled={busy}
                                onClick={() => act('discard')}
                                className="px-3 py-1.5 rounded text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white cursor-pointer transition-colors"
                            >
                                Discard
                            </button>
                        </>
                    )}

                    {applied > 0 && (
                        <button
                            disabled={busy}
                            onClick={() => act('revert')}
                            className="px-3 py-1.5 rounded text-xs bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white cursor-pointer transition-colors"
                        >
                            Revert {applied}
                        </button>
                    )}
                </div>
            </div>

            {/* Scrolls inside the drawer — the canvas above it must not move. */}
            {open && (
                <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="text-slate-500">
                            <tr className="border-b border-slate-800">
                                <th className="text-left font-medium px-4 py-2">Row</th>
                                <th className="text-left font-medium px-4 py-2">Column</th>
                                <th className="text-left font-medium px-4 py-2">Before</th>
                                <th className="text-left font-medium px-4 py-2">After</th>
                                <th className="text-left font-medium px-4 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proposals.map((p) => (
                                <tr key={p.id} className="border-b border-slate-800/60">
                                    <td className="px-4 py-2 text-slate-400 font-mono">{p.list_lead_id}</td>
                                    <td className="px-4 py-2">
                                        <span className="text-slate-200">{p.column_raw_name || p.column_name}</span>
                                        <span className="text-slate-600 ml-1.5">
                                            {TARGET_LABELS[p.target] ?? p.target}
                                        </span>
                                        {p.is_new_column && (
                                            <span className="ml-1.5 text-amber-400/80">new</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-slate-500 max-w-[220px] truncate">
                                        {display(p.previous_value)}
                                    </td>
                                    <td className="px-4 py-2 text-slate-200 max-w-[220px] truncate">
                                        {display(p.new_value)}
                                    </td>
                                    <td className={`px-4 py-2 ${STATUS_STYLES[p.status] ?? 'text-slate-400'}`}>
                                        {p.status}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
