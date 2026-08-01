'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Workflow from '@/components/workflow/Workflow';

/**
 * The Conversation Agent's surface.
 *
 * Chat on the left, whatever the agent has proposed on the right. The proposal is rendered
 * through the same read-only canvas the Executions tab uses, so what the user approves here
 * is literally what will run.
 *
 * This component never writes to the list. It runs a 10-row test whose writes are staged as
 * proposals; approving them is a separate step on the Executions tab.
 */

const TEST_ROW_COUNT = 10;

type Message = { role: 'user' | 'assistant'; content: string };
type Proposal = { graph: { nodes: any[]; edges: any[] }; spec: any };

export default function AgentChat({
    viewId,
    onOpenExecution,
}: {
    viewId: string;
    onOpenExecution?: (executionId: string) => void;
}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [activity, setActivity] = useState<string | null>(null);
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [running, setRunning] = useState(false);
    const [lastExecutionId, setLastExecutionId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [savedId, setSavedId] = useState<number | null>(null);

    const transcriptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
    }, [messages, activity]);

    async function send() {
        const text = draft.trim();
        if (!text || streaming) return;

        const next: Message[] = [...messages, { role: 'user', content: text }];
        setMessages(next);
        setDraft('');
        setStreaming(true);
        setActivity(null);

        // The assistant turn is appended empty and filled in by the stream.
        setMessages([...next, { role: 'assistant', content: '' }]);

        try {
            const res = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ viewId: Number(viewId), messages: next }),
            });

            if (!res.body) throw new Error('No response stream');

            await readStream(res.body, (event) => {
                if (event.error) {
                    toast.error(event.error);
                    return;
                }

                if (event.type === 'text') {
                    setActivity(null);
                    setMessages((prev) => {
                        const copy = [...prev];
                        const last = copy[copy.length - 1];
                        if (last?.role === 'assistant') {
                            copy[copy.length - 1] = { ...last, content: last.content + event.text };
                        }
                        return copy;
                    });
                }

                if (event.type === 'tool') setActivity(event.name);

                if (event.type === 'workflow') {
                    setProposal({ graph: event.graph, spec: event.spec });
                    // A new proposal is a different workflow — clear what the last one earned.
                    setLastExecutionId(null);
                    setSavedId(null);
                }
            });
        } catch (err: any) {
            toast.error(err?.message || 'The agent failed');
        } finally {
            setStreaming(false);
            setActivity(null);
        }
    }

    async function saveWorkflow() {
        if (!proposal || saving) return;

        // Name is optional — the API generates one when it is blank.
        const trimmed = name.trim();

        setSaving(true);

        try {
            const res = await fetch('/api/views/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ viewId: Number(viewId), name: trimmed || undefined, graph: proposal.graph }),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            setSavedId(data.data.id);
            toast.success(`Saved as "${data.data.name}" — find it on the Workflow tab`);
        } catch (err: any) {
            toast.error(err?.message || 'Could not save the workflow');
        } finally {
            setSaving(false);
        }
    }

    async function runTest() {
        if (!proposal || running) return;

        setRunning(true);
        setLastExecutionId(null);
        const toastId = toast.loading(`Running on ${TEST_ROW_COUNT} rows…`);

        try {
            const res = await fetch('/api/views/workflows/run/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodes: proposal.graph.nodes,
                    edges: proposal.graph.edges,
                    viewId,
                    isTest: true,
                    rowLimit: TEST_ROW_COUNT,
                    // Only set once saved — an unsaved proposal has no workflow to trace to.
                    workflowId: savedId,
                }),
            });

            if (!res.body) throw new Error('No response stream');

            let executionId: string | null = null;
            let failed = false;

            await readStream(res.body, (event) => {
                if (event.executionId) executionId = String(event.executionId);
                if (event.error) {
                    failed = true;
                    toast.error(event.error, { id: toastId });
                }
            });

            if (!failed) {
                setLastExecutionId(executionId);
                toast.success('Test run finished — review the staged changes', { id: toastId });
            }
        } catch (err: any) {
            toast.error(err?.message || 'The run failed', { id: toastId });
        } finally {
            setRunning(false);
        }
    }

    return (
        <div className="flex h-full">
            {/* CHAT */}
            <div className="flex flex-col w-[420px] shrink-0 border-r border-slate-700">
                <div ref={transcriptRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-xs text-slate-500 leading-relaxed">
                            Describe what you want done to this list — for example,{' '}
                            <span className="text-slate-400">
                                &ldquo;normalize every email and save the domain to a new column&rdquo;
                            </span>
                            . I will check what the tool registry can actually do, build a workflow, and
                            run it against {TEST_ROW_COUNT} rows so you can review every change before
                            anything is saved.
                        </div>
                    )}

                    {messages.map((message, i) => (
                        <div key={i}>
                            <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1">
                                {message.role === 'user' ? 'You' : 'Agent'}
                            </div>
                            <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {message.content ||
                                    (streaming && i === messages.length - 1 ? (
                                        <span className="text-slate-500">Thinking…</span>
                                    ) : null)}
                            </div>
                        </div>
                    ))}

                    {activity && <div className="text-xs text-slate-500 italic">{activity}…</div>}
                </div>

                <div className="shrink-0 border-t border-slate-700 p-3">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                        rows={3}
                        placeholder="What should this workflow do?"
                        disabled={streaming}
                        className="w-full resize-none rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 disabled:opacity-50"
                    />
                    <button
                        onClick={send}
                        disabled={streaming || !draft.trim()}
                        className="mt-2 w-full px-3 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white cursor-pointer transition-colors"
                    >
                        {streaming ? 'Working…' : 'Send'}
                    </button>
                </div>
            </div>

            {/* PROPOSAL */}
            <div className="flex-1 min-h-0 flex flex-col">
                {!proposal && (
                    <div className="flex items-center justify-center h-full text-sm text-slate-600">
                        The proposed workflow appears here
                    </div>
                )}

                {proposal && (
                    <>
                        <div className="flex-1 min-h-0">
                            <Workflow
                                rows={[]}
                                initialNodes={proposal.graph.nodes}
                                initialEdges={proposal.graph.edges as any}
                                mode="view"
                                viewId={viewId}
                            />
                        </div>

                        <div className="shrink-0 border-t border-slate-700 bg-slate-900/60 px-4 py-3 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Proposed workflow
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    {lastExecutionId
                                        ? `Ran on ${TEST_ROW_COUNT} rows — nothing saved yet`
                                        : `Runs on ${TEST_ROW_COUNT} rows, staged for your approval`}
                                </div>
                            </div>

                            <div className="flex gap-2 items-center">
                                {!savedId && (
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && saveWorkflow()}
                                        placeholder="Name (optional)…"
                                        className="w-40 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                                    />
                                )}

                                <button
                                    onClick={saveWorkflow}
                                    disabled={saving || savedId !== null}
                                    className="px-3 py-1.5 rounded text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white cursor-pointer transition-colors"
                                >
                                    {savedId ? 'Saved' : saving ? 'Saving…' : 'Save'}
                                </button>

                                {lastExecutionId && onOpenExecution && (
                                    <button
                                        onClick={() => onOpenExecution(lastExecutionId)}
                                        className="px-3 py-1.5 rounded text-xs bg-green-600 hover:bg-green-500 text-white cursor-pointer transition-colors"
                                    >
                                        Review changes
                                    </button>
                                )}

                                <button
                                    onClick={runTest}
                                    disabled={running}
                                    className="px-3 py-1.5 rounded text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white cursor-pointer transition-colors"
                                >
                                    {running
                                        ? 'Running…'
                                        : lastExecutionId
                                            ? 'Run again'
                                            : `Run test on ${TEST_ROW_COUNT} rows`}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/** Reads the `data: {...}\n\n` SSE shape both of this app's streaming routes emit. */
async function readStream(body: ReadableStream<Uint8Array>, onEvent: (event: any) => void) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
            if (!part.startsWith('data: ')) continue;
            try {
                onEvent(JSON.parse(part.slice(6)));
            } catch (err) {
                console.error('Stream parse error:', err);
            }
        }
    }
}
