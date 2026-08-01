'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Workflow, { StrictEdge } from './Workflow';

/**
 * A view's saved workflows: pick one on the left, edit it on the right.
 *
 * The sidebar collapses to a rail so building a graph can have the full canvas, without
 * ever losing the way back.
 */

type WorkflowSummary = {
    id: number;
    name: string;
    description: string | null;
    version: number;
    status: string;
    updated_at: string;
};

type LoadedWorkflow = WorkflowSummary & { graph: { nodes: any[]; edges: StrictEdge[] } };

const COLLAPSE_KEY = 'workflows.sidebar.collapsed';

export default function WorkflowsPanel({ viewId, rows }: { viewId: string; rows: any[] }) {
    const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
    const [selected, setSelected] = useState<LoadedWorkflow | null>(null);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    /** Inline two-step delete, so nothing here needs a modal. */
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    useEffect(() => {
        setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    }, []);

    useEffect(() => {
        fetchWorkflows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewId]);

    function toggleCollapsed() {
        setCollapsed((prev) => {
            localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
            return !prev;
        });
    }

    async function fetchWorkflows() {
        setLoading(true);
        try {
            const res = await fetch(`/api/views/workflows?viewId=${viewId}`);
            const data = await res.json();
            setWorkflows(data.data ?? []);
        } catch {
            toast.error('Could not load workflows');
        } finally {
            setLoading(false);
        }
    }

    async function open(id: number) {
        if (selected?.id === id) return;

        try {
            const res = await fetch(`/api/views/workflows/${id}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setSelected(data.data);
        } catch (err: any) {
            toast.error(err?.message || 'Could not open that workflow');
        }
    }

    /**
     * Opens a blank canvas straight away. The name is not asked for here — the server gives
     * the row a generated one, and the canvas's name field is where it gets changed.
     */
    async function create() {
        try {
            const res = await fetch('/api/views/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ viewId: Number(viewId) }),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            await fetchWorkflows();
            setSelected(data.data);
        } catch (err: any) {
            toast.error(err?.message || 'Could not create the workflow');
        }
    }

    async function save(id: number, nodes: any[], edges: StrictEdge[], name: string) {
        const res = await fetch(`/api/views/workflows/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, graph: { nodes, edges } }),
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        // The trigger owns `version`, and a blank name leaves the old one standing, so take
        // the row back rather than guessing at either.
        setSelected((prev) =>
            prev && prev.id === id
                ? { ...prev, version: data.data.version, name: data.data.name }
                : prev
        );
        fetchWorkflows();
    }

    async function remove(id: number) {
        setConfirmDeleteId(null);

        try {
            const res = await fetch(`/api/views/workflows/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            if (selected?.id === id) setSelected(null);
            fetchWorkflows();
            toast.success('Deleted');
        } catch (err: any) {
            toast.error(err?.message || 'Could not delete');
        }
    }

    return (
        <div className="flex h-full">
            {/* SIDEBAR — width transition, not conditional rendering, so the list is not
                refetched on every toggle. */}
            <div
                className={`shrink-0 border-r border-slate-700 flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out ${
                    collapsed ? 'w-10' : 'w-[300px]'
                }`}
            >
                <div className="flex items-center justify-between shrink-0 h-11 px-2 border-b border-slate-800">
                    {!collapsed && (
                        <button
                            onClick={create}
                            className="px-2 py-1 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors whitespace-nowrap"
                        >
                            + New workflow
                        </button>
                    )}

                    <button
                        onClick={toggleCollapsed}
                        aria-label={collapsed ? 'Show workflows' : 'Hide workflows'}
                        title={collapsed ? 'Show workflows' : 'Hide workflows'}
                        className="px-2 py-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors mx-auto"
                    >
                        {collapsed ? '›' : '‹'}
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {!collapsed && loading && (
                        <div className="p-3 text-xs text-slate-500">Loading…</div>
                    )}

                    {!collapsed && !loading && workflows.length === 0 && (
                        <div className="p-3 text-xs text-slate-500 leading-relaxed">
                            No workflows yet. Build one here, or ask for one on the Agent tab and save it.
                        </div>
                    )}

                    {!collapsed &&
                        workflows.map((workflow) => (
                            <div
                                key={workflow.id}
                                onClick={() => open(workflow.id)}
                                className={`group px-3 py-2.5 border-b border-slate-800 cursor-pointer hover:bg-slate-800 ${
                                    selected?.id === workflow.id ? 'bg-slate-800' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm text-white truncate">{workflow.name}</span>
                                    {confirmDeleteId !== workflow.id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmDeleteId(workflow.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 text-xs cursor-pointer transition-opacity shrink-0"
                                            title="Delete"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {confirmDeleteId === workflow.id ? (
                                    <div className="text-[11px] mt-1 flex items-center gap-2">
                                        <span className="text-slate-400">Delete? Past runs are kept.</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                remove(workflow.id);
                                            }}
                                            className="text-red-400 hover:text-red-300 cursor-pointer"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmDeleteId(null);
                                            }}
                                            className="text-slate-500 hover:text-slate-300 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                        v{workflow.version} · {new Date(workflow.updated_at).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        ))}
                </div>
            </div>

            {/* CANVAS */}
            <div className="flex-1 min-h-0 relative">
                {!selected && (
                    <div className="flex items-center justify-center h-full text-sm text-slate-600">
                        {workflows.length === 0 ? 'Create a workflow to begin' : 'Select a workflow'}
                    </div>
                )}

                {selected && (
                    /* key remounts the canvas per workflow: useNodesState treats its
                       argument as initial state only and never re-syncs, so without this
                       switching workflows would leave the previous graph on screen. The
                       name field is seeded the same way, for the same reason. */
                    <Workflow
                        key={selected.id}
                        rows={rows.slice(0, 11)}
                        initialNodes={selected.graph?.nodes ?? []}
                        initialEdges={selected.graph?.edges ?? []}
                        initialName={selected.name}
                        viewId={viewId}
                        workflowId={selected.id}
                        onSave={(nodes, edges, name) => save(selected.id, nodes, edges, name)}
                    />
                )}
            </div>
        </div>
    );
}
