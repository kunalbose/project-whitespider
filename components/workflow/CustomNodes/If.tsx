import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { NodeData } from '../Workflow';

type IfNodeConfig = {
    label?: string;
    field?: string;
    operator?: 'equals' | 'not_equals';
    value?: string;
};

type IfNodeData = Node<NodeData<IfNodeConfig>, 'if'>;

const IfNode = ({ id, data, selected }: NodeProps<IfNodeData>) => {
    return (
        <div className="group relative min-w-[240px]">

            <div className={`
                w-full h-full shadow-xl rounded-lg overflow-hidden border-2 transition duration-300
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

                {/* Header */}
                <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2 justify-center w-full">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {data.label || 'If'}
                        </span>
                    </div>
                </div>
            </div>

            {/* INPUT */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3 bg-slate-700 border-2 border-slate-900"
            />

            {/* TRUE HANDLE */}
            <Handle
                type="source"
                id="true"
                position={Position.Right}
                style={{ top: '35%' }}
                className="w-3 h-3 bg-green-500 border-2 border-slate-900"
            />

            {/* FALSE HANDLE */}
            <Handle
                type="source"
                id="false"
                position={Position.Right}
                style={{ top: '65%' }}
                className="w-3 h-3 bg-red-500 border-2 border-slate-900"
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

export default IfNode;

type IfNodeConfigProps = {
    node: Node<NodeData<IfNodeConfig>, 'if'>;
    updateNodeData: (
        nodeId: string,
        updater: (data: any) => any
    ) => void;
};

export const IfNodeConfig = ({ node, updateNodeData }: IfNodeConfigProps) => {
    const handleChange = (key: string, value: string) => {
        updateNodeData(node.id, (prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    return (
        <div className="flex flex-col gap-4 p-2">
            <header className="border-b border-slate-700 pb-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    Condition Settings
                </h3>
            </header>

            {/* Field Input */}
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Property Name</label>
                <input
                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="e.g. email"
                    value={node.data.field || ''}
                    onChange={(e) => handleChange('field', e.target.value)}
                />
            </div>

            {/* Operator Select */}
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Operator</label>
                <div className="relative">
                    <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                        value={node.data.operator || 'equals'}
                        onChange={(e) => handleChange('operator', e.target.value)}
                    >
                        <option value="equals">is equal to</option>
                        <option value="not_equals">is not equal to</option>
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Value Input */}
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Comparison Value</label>
                <input
                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="e.g. user@example.com"
                    value={node.data.value || ''}
                    onChange={(e) => handleChange('value', e.target.value)}
                />
            </div>
        </div>
    );
};