'use client';

import { useMemo, useState } from 'react';
import { addEdge, Background, Connection, Controls, Edge, Node, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import NoOperation from './CustomNodes/NoOperation';
import TestNode from './CustomNodes/TestNode';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import IfNode from './CustomNodes/If';
import { nodeConfigRegistry } from './CustomNodes/configRegistery';

const ReactJson = dynamic(
    () => import('@microlink/react-json-view'),
    { ssr: false }
);

export type StrictEdge = Edge & {
    animated: boolean;
    sourceHandle: string | null;
    targetHandle: string | null;
    // type: string;
};

export type RuntimeData = {
    input?: Record<string, any>;
    output?: Record<string, any>;
    status?: 'idle' | 'running' | 'completed' | 'error';
};

export type NodeData<TConfig = {}> = TConfig & RuntimeData & {
    onChange?: (nodeId: string, updater: (data: any) => any) => void;
    onDelete?: (nodeId: string) => void;
};

type AnyNodeData = NodeData<any>;

type NodeType = {
    id: string;
    name: string;
    key: string;
    description: string;
    category: string;
    config_schema: any;
    input_schema: any;
    output_schema: any;
}

const Workflow = ({ rows, initialNodes, initialEdges, mode = 'edit', viewId }: { rows: any[], initialNodes?: Node<AnyNodeData>[], initialEdges?: StrictEdge[], mode?: 'edit' | 'view', viewId: string }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<AnyNodeData>>(initialNodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState<StrictEdge>(initialEdges || []);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [nodeMenu, setNodeMenu] = useState<NodeType[]>([]);
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

    const activeNode = nodes.find((n) => n.id === activeNodeId);

    const ConfigComponent =
        activeNode && activeNode.type && nodeConfigRegistry[activeNode.type]
            ? nodeConfigRegistry[activeNode.type]
            : null;

    const nodeTypes = useMemo(() => ({
        noop: NoOperation,
        test: TestNode,
        if: IfNode
    }), []);

    const addNode = (type: string, name: string) => {
        const newNode = {
            id: crypto.randomUUID(),
            type,
            position: { x: 250, y: 250 },
            data: {
                label: name,
                selectedRowId: null,
                rows: rows.slice(0, 10),
                onChange: updateNodeData,
                onDelete: deleteNode,
                input: undefined,
                output: undefined,
                status: 'idle',
            },
        };

        setNodes((nds) => nds.concat(newNode));
        setIsSidebarOpen(false);
    };

    const onConnect = (connection: Connection) => {
        if (!connection.source || !connection.target) return;
        const edge = { ...connection, animated: true, id: crypto.randomUUID(), sourceHandle: connection.sourceHandle ?? null, targetHandle: connection.targetHandle ?? null, };
        setEdges(prevEdges => addEdge(edge, prevEdges));
    }


    async function openSidebar(options?: {
        category?: string;
        excludeCategory?: string;
    }) {
        const params = new URLSearchParams();

        if (options?.category) {
            params.append('category', options.category);
        }

        if (options?.excludeCategory) {
            params.append('excludeCategory', options.excludeCategory);
        }

        const res = await fetch(`/api/views/nodes?${params.toString()}`); //needs to be node-type to prevent confusion later on
        const data = await res.json();
        setNodeMenu(data.data);

        setIsSidebarOpen(true);
    }

    function updateNodeData(nodeId: string, updater: (data: any) => any) {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === nodeId) {
                    return {
                        ...node,
                        data: updater(node.data),
                    };
                }
                return node;
            })
        );
    }

    function deleteNode(nodeId: string) {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) =>
            eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
        );
    }

    async function runWorkflow() {
        setNodes((nodes) =>
            nodes.map((n) => ({
                ...n,
                data: {
                    ...n.data,
                    input: undefined,
                    output: undefined,
                    status: 'idle',
                },
            }))
        );

        const toastId = toast.loading('Running workflow...');

        try {

            const res = await fetch('/api/views/workflows/run/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodes, edges, viewId }),
            });

            if (!res.body) {
                toast.error('No response stream');
                return;
            }

            const reader = res.body.getReader();
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
                        const parsed = JSON.parse(part.replace('data: ', ''));

                        if (parsed.error) {
                            toast.error(parsed.error, { id: toastId });
                            return;
                        }

                        if (parsed.done) {
                            toast.success('Workflow completed', { id: toastId });
                            continue;
                        }

                        if (parsed.nodeId) {
                            updateNodeData(parsed.nodeId, (prev) => ({
                                ...prev,
                                ...parsed.patch,
                            }));
                        }

                    } catch (err) {
                        console.error('Stream parse error:', err);
                    }
                }
            }
        } catch (err) {
            console.error(err);
            toast.error('Something went wrong during execution', { id: toastId });
        }
    }

    return (
        <div className="relative w-full h-full flex overflow-hidden">
            <div className="relative flex-grow h-full">
                {nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {mode === 'edit' && (<button
                            onClick={() => openSidebar({ category: 'Execution' })}
                            className="h-16 w-16 rounded-full bg-white text-black text-3xl cursor-pointer hover:bg-gray-200 transition-colors"
                        >
                            +
                        </button>)}
                    </div>
                )}

                {nodes.length > 0 && (
                    <div style={{ width: '100%', height: '100%', background: 'black' }}>
                        {mode === 'edit' && (<button
                            onClick={runWorkflow}
                            className="absolute top-4 right-4 z-10 bg-green-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-green-600 transition-colors"
                        >
                            Run
                        </button>)}
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            onNodesChange={mode === 'edit' ? onNodesChange : undefined}
                            onEdgesChange={mode === 'edit' ? onEdgesChange : undefined}
                            onConnect={mode === 'edit' ? onConnect : undefined}
                            nodesDraggable={mode === 'edit'}
                            nodesConnectable={mode === 'edit'}
                            elementsSelectable={true}
                            fitView
                            onNodeDoubleClick={(_, node) => setActiveNodeId(node.id)}
                            onNodeClick={(_, node) => {
                                if (mode === 'view') {
                                    setActiveNodeId(node.id);
                                }
                            }}
                        >
                            <Background />
                            <Controls style={{ background: '#fff', border: '1px solid #777', borderRadius: '5px', color: 'black' }} />
                        </ReactFlow>
                        {mode === 'edit' && (<button
                            onClick={() => openSidebar({ excludeCategory: 'Execution' })}
                            className="absolute bottom-4 right-4 z-10 h-12 w-12 rounded-full bg-white text-black text-2xl shadow-lg cursor-pointer"
                        >
                            +
                        </button>)}
                    </div>
                )}

                {activeNode && (
                    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
                        <div className="w-[90%] h-[85%] bg-slate-900 rounded-xl border border-slate-700 flex overflow-hidden">

                            {/* LEFT: INPUT */}
                            <div className="w-1/3 border-r border-slate-700 p-4 overflow-auto">
                                <h2 className="text-sm font-bold text-slate-400 mb-2">INPUT</h2>
                                <ReactJson
                                    src={activeNode.data.input || {}}
                                    theme="monokai"
                                    collapsed={2}
                                    enableClipboard
                                    displayDataTypes={false}
                                    displayObjectSize={false}
                                    name={false}
                                />
                            </div>

                            {/* CENTER: NODE DETAILS */}
                            <div className="w-1/3 border-r border-slate-700 p-4">
                                <h2 className="text-sm font-bold text-slate-400 mb-4">
                                    {activeNode.data.label || activeNode.type}
                                </h2>

                                {/* <div className="text-xs text-slate-300 space-y-2">
                                    <div>Status: {activeNode.data.status || 'idle'}</div>
                                    <div>ID: {activeNode.id}</div>
                                </div> */}
                                {ConfigComponent ? (
                                    <ConfigComponent
                                        node={activeNode}
                                        updateNodeData={updateNodeData}
                                    />
                                ) : (
                                    <div className="text-xs text-slate-500">No config</div>
                                )}

                                <button
                                    onClick={() => setActiveNodeId(null)}
                                    className="mt-6 px-3 py-1 bg-red-500 text-white rounded text-xs cursor-pointer hover:bg-red-600 transition-colors"
                                >
                                    Close
                                </button>
                            </div>

                            {/* RIGHT: OUTPUT */}
                            <div className="w-1/3 p-4 overflow-auto">
                                <h2 className="text-sm font-bold text-slate-400 mb-2">OUTPUT</h2>
                                <ReactJson
                                    src={activeNode.data.output || {}}
                                    theme="monokai"
                                    collapsed={2}
                                    enableClipboard
                                    displayDataTypes={false}
                                    displayObjectSize={false}
                                    name={false}
                                />
                            </div>

                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar */}
            <div className={`absolute top-0 right-0 h-full w-64 bg-slate-900 border-l border-slate-700 p-4 transition-transform duration-300 ease-in-out z-50 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-white font-bold text-lg">Add Node</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
                </div>

                <div className="space-y-3">
                    {nodeMenu.map((menuNode) => (
                        <div
                            key={menuNode.id}
                            onClick={() => addNode(menuNode.key, menuNode.name)}
                            className="p-3 bg-slate-800 border border-slate-600 rounded cursor-pointer hover:bg-slate-700 hover:border-blue-500 text-white transition-all"
                        >
                            {menuNode.name}
                        </div>
                    ))}
                </div>
            </div>

            {/* Backdrop to close sidebar when clicking outside */}
            {isSidebarOpen && (
                <div
                    className="absolute inset-0 bg-black/50 z-40"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    );
};

export default Workflow;