'use client';

import { useEffect, useState } from 'react';
import Workflow from './Workflow';

type ExecutionListItem = {
    id: string;
    started_at: string;
    status: 'completed' | 'failed' | 'running';
    is_test: boolean;
};

export default function ExecutionsViewer({
    viewId,
    rows,
}: {
    viewId: string;
    rows: any[];
}) {
    const [executions, setExecutions] = useState<ExecutionListItem[]>([]);
    const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
    const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);
    const [loadingSnapshot, setLoadingSnapshot] = useState(false);

    useEffect(() => {
        fetchExecutions();
    }, [viewId]);

    async function fetchExecutions() {
        const res = await fetch(`/api/views/workflows/executions?viewId=${viewId}`);
        const data = await res.json();
        setExecutions(data.data || []);
    }

    // 🔥 2. Fetch snapshot only on click
    async function handleSelectExecution(execId: string) {
        setSelectedExecutionId(execId);
        setLoadingSnapshot(true);
        setSelectedSnapshot(null);

        const res = await fetch(`/api/views/workflows/executions/${execId}`);
        const data = await res.json();

        setSelectedSnapshot(data.snapshot);
        setLoadingSnapshot(false);
    }

    return (
        <div className="flex h-full">

            {/* LEFT PANEL */}
            <div className="w-[300px] border-r border-slate-700 overflow-y-auto">
                {executions.map((exec) => (
                    <div
                        key={exec.id}
                        onClick={() => handleSelectExecution(exec.id)}
                        className={`
                            p-3 border-b border-slate-800 cursor-pointer hover:bg-slate-800
                            ${selectedExecutionId === exec.id ? 'bg-slate-800' : ''}
                        `}
                    >
                        <div className="text-sm text-white">
                            {new Date(exec.started_at).toLocaleString()}
                        </div>

                        <div className="text-xs text-slate-400">
                            {exec.status === 'completed' ? '✅ Success' : '❌ Failed'}
                        </div>

                        {exec.is_test && (
                            <div className="text-[10px] text-yellow-400 mt-1">
                                🧪 Test Run
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* RIGHT PANEL */}
            <div className="flex-1 relative">

                {loadingSnapshot && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                        Loading execution...
                    </div>
                )}

                {!loadingSnapshot && selectedSnapshot && (
                    <Workflow
                        rows={rows}
                        initialNodes={selectedSnapshot.nodes}
                        initialEdges={selectedSnapshot.edges}
                        mode="view"
                        viewId={viewId}
                    />
                )}

                {!loadingSnapshot && !selectedSnapshot && (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        Select an execution
                    </div>
                )}
            </div>
        </div>
    );
}