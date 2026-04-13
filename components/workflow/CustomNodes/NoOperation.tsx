import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { NodeData } from '../Workflow';

type NoOpNodeConfig = {
    label?: string;
};

type NoOperationNodeData = Node<NodeData<NoOpNodeConfig>, 'noOperation'>

const NoOperationNode = ({ id, data, selected }: NodeProps<NoOperationNodeData>) => {
    return (
        <div className={`group relative min-w-[200px]`}>
            <div className={`
                    w-full h-full shadow-xl rounded-lg overflow-hidden border-2 transition-[border,box-shadow] duration-300
                    ${data.status === 'running'
                    ? 'border-yellow-500 ring-2 ring-yellow-500/30'
                    : data.status === 'completed'
                        ? 'border-green-500 ring-2 ring-green-500/30'
                        : data.status === 'error'
                            ? 'border-red-500 ring-2 ring-red-500/30'
                            : selected
                                ? 'border-blue-500 ring-2 ring-blue-500/20'
                                : 'border-slate-800'
                }
                    bg-slate-900 text-slate-200 cursor-pointer
            `}>
                <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2 justify-center w-full">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {data.label || 'No Operation'}
                        </span>
                    </div>
                </div>

                <div className="p-4 flex items-center justify-center">
                    <span className="text-xs text-slate-500 italic">
                        Pass-through (No Action)
                    </span>
                </div>
            </div>

            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3 bg-slate-700 border-2 border-slate-900 !-left-[7px]"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="w-3 h-3 bg-blue-500 border-2 border-slate-900 !-right-[7px]"
            />

            <button
                className="
                    absolute
                    -bottom-4
                    left-1/2
                    -translate-x-1/2
                    opacity-0
                    group-hover:opacity-100
                    transition-opacity
                    duration-150
                    bg-neutral-900
                    border border-red-500/60
                    rounded-full
                    p-1.5
                    shadow-md
                    cursor-pointer
                    z-10
                "
                onClick={() => data.onDelete?.(id)}
            >
                <svg
                    className="h-4 w-4 text-red-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
            </button>
        </div>
    );
};

export default NoOperationNode;