'use client';

import { useMemo, useState } from 'react';
import { addEdge, Background, Connection, Controls, Edge, Node, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import NoOperation from './CustomNodes/NoOperation';
import TestNode from './CustomNodes/TestNode';

export type StrictEdge = Edge & {
    animated: boolean;
    sourceHandle: string | null;
    targetHandle: string | null;
    // type: string;
};

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

const Workflow = ({ rows }: { rows: any[] }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<StrictEdge>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [nodeMenu, setNodeMenu] = useState<NodeType[]>([]);

    const nodeTypes = useMemo(() => ({
        noop: NoOperation,
        test: TestNode,
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
        const res = await fetch('/api/views/workflows/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nodes,
                edges,
                viewId: 1,
            }),
        });

        const data = await res.json();
        console.log('Execution Result:', data);
    }

    return (
        <div className="relative w-full h-full flex overflow-hidden">
            <div className="relative flex-grow h-full">
                {nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <button
                            onClick={() => openSidebar({ category: 'Execution' })}
                            className="h-16 w-16 rounded-full bg-white text-black text-3xl cursor-pointer hover:bg-gray-200 transition-colors"
                        >
                            +
                        </button>
                    </div>
                )}

                {nodes.length > 0 && (
                    <div style={{ width: '100%', height: '100%', background: 'black' }}>
                        <button
                            onClick={runWorkflow}
                            className="absolute top-4 right-4 z-10 bg-green-500 text-white px-4 py-2 rounded"
                        >
                            Run
                        </button>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            fitView
                        >
                            <Background />
                            <Controls style={{ background: '#fff', border: '1px solid #777', borderRadius: '5px', color: 'black' }} />
                        </ReactFlow>

                        {/* Floating button to add more nodes when canvas isn't empty */}
                        <button
                            onClick={() => openSidebar({ excludeCategory: 'Execution' })}
                            className="absolute bottom-4 right-4 z-10 h-12 w-12 rounded-full bg-white text-black text-2xl shadow-lg cursor-pointer"
                        >
                            +
                        </button>
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