import { Handle, Node, NodeProps, Position } from '@xyflow/react';

type TestNodeData = Node<{
    label: string;
    selectedRowId?: number;
    rows?: any[];
    onChange?: (nodeId: string, updater: (data: any) => any) => void;
    onDelete?: (nodeId: string) => void;
}, 'test'>

const TestNode = ({ id, data, selected }: NodeProps<TestNodeData>) => {
    return (
        <div className="group relative min-w-[220px]">
            <div className={`
                w-full h-full shadow-xl rounded-lg overflow-hidden border-2 transition-all
                ${selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-800'}
                bg-slate-900 text-slate-200 cursor-pointer
            `}>
                <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2 justify-center w-full">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {data.label || 'Test Node'}
                        </span>
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-slate-400 ml-0.5">
                            Select Data Source
                        </label>

                        <select
                            className="w-full bg-slate-800 border border-slate-700 text-sm p-2 rounded-md 
                                     focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                                     text-slate-100 cursor-pointer appearance-none"
                            value={data.selectedRowId ?? ''}
                            onChange={(e) => {
                                const value = Number(e.target.value);
                                data.onChange?.(id, (prev) => ({
                                    ...prev,
                                    selectedRowId: value,
                                }));
                            }}
                        >
                            <option value="" className="bg-slate-900">
                                Select Row...
                            </option>

                            {data.rows?.map((row) => (
                                <option key={row.id} value={row.id} className="bg-slate-900">
                                    {row.id} - {row.schema?.name || 'No Name'}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="w-3 h-3 bg-blue-500 border-2 border-slate-900"
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

export default TestNode;