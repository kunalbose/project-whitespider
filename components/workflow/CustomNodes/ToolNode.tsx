import { useRef } from 'react';
import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { NodeData } from '../Workflow';

type ToolNodeConfigShape = {
    label?: string;
    toolName?: string;
    inputSchema?: any;
    arguments?: Record<string, any>;
    rows?: any[];
};

type ToolNodeData = Node<NodeData<ToolNodeConfigShape>, 'tool'>;

/**
 * ONE component for every registry tool. There is no per-tool React code — the header
 * comes from the registry row and the config form is generated from its input_schema.
 */
const ToolNode = ({ id, data, selected }: NodeProps<ToolNodeData>) => {
    return (
        <div className="group relative min-w-[200px]">
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
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {data.label || 'Tool'}
                        </span>
                    </div>
                </div>

                <div className="p-4 flex items-center justify-center">
                    <span className="text-xs text-slate-500 font-mono">
                        {data.toolName || 'unconfigured'}
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
                className="w-3 h-3 bg-purple-500 border-2 border-slate-900 !-right-[7px]"
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

export default ToolNode;

type ToolNodeConfigProps = {
    node: Node<NodeData<ToolNodeConfigShape>, 'tool'>;
    updateNodeData: (nodeId: string, updater: (data: any) => any) => void;
};

/**
 * The config form is generated from the tool's input_schema — the JSON in the registry
 * row, not any React code. This is the last node UI that needs to be written; every
 * future tool renders through it.
 */
export const ToolNodeConfig = ({ node, updateNodeData }: ToolNodeConfigProps) => {
    // Either element works for insertField — both carry selectionStart.
    const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

    const schema = node.data.inputSchema ?? {};
    const properties: Record<string, any> = schema.properties ?? {};
    const required: string[] = Array.isArray(schema.required) ? schema.required : [];
    const args = node.data.arguments ?? {};

    // Field names from the sample data, so templating is discoverable without docs.
    // `rows` are list_leads_membership records ({ id, list_id, schema }), but the engine
    // feeds row.schema as the item — so the offered fields must come from the schema.
    const sampleRow = node.data.rows?.[0];
    const sampleItem = sampleRow?.schema ?? sampleRow;
    const availableFields = sampleItem ? Object.keys(sampleItem) : [];

    const setArgument = (key: string, value: string) => {
        updateNodeData(node.id, (prev) => ({
            ...prev,
            arguments: { ...(prev.arguments ?? {}), [key]: value },
        }));
    };

    const insertField = (key: string, field: string) => {
        if (!field) return;

        const el = inputRefs.current[key];
        const current = String(args[key] ?? '');
        const token = `{{ item.${field} }}`;
        const at = el?.selectionStart ?? current.length;

        setArgument(key, current.slice(0, at) + token + current.slice(at));
    };

    const propertyKeys = Object.keys(properties);

    return (
        <div className="flex flex-col gap-4 p-2 overflow-auto max-h-full">
            <header className="border-b border-slate-700 pb-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    Tool Settings
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                    {node.data.toolName}
                </p>
            </header>

            {propertyKeys.length === 0 && (
                <div className="text-xs text-slate-500">This tool takes no arguments.</div>
            )}

            {propertyKeys.map((key) => {
                const prop = properties[key] ?? {};
                const isRequired = required.includes(key);
                // Still schema-driven, still no per-tool React: a property that holds a
                // paragraph rather than a value says so with format: 'textarea'.
                const isMultiline = prop.format === 'textarea';
                const fieldClass =
                    'w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all';
                const placeholder = prop.description || `${prop.type || 'value'} or {{ item.field }}`;

                return (
                    <div key={key} className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            {key}
                            {isRequired && <span className="text-red-400">*</span>}
                            <span className="text-slate-600 font-normal">({prop.type || 'any'})</span>
                        </label>

                        {isMultiline ? (
                            <textarea
                                ref={(el) => { inputRefs.current[key] = el; }}
                                rows={6}
                                className={`${fieldClass} resize-y leading-relaxed`}
                                placeholder={placeholder}
                                value={args[key] ?? ''}
                                onChange={(e) => setArgument(key, e.target.value)}
                            />
                        ) : (
                            <input
                                ref={(el) => { inputRefs.current[key] = el; }}
                                className={fieldClass}
                                placeholder={placeholder}
                                value={args[key] ?? ''}
                                onChange={(e) => setArgument(key, e.target.value)}
                            />
                        )}

                        {availableFields.length > 0 && (
                            <select
                                className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-[11px] text-slate-400 cursor-pointer outline-none"
                                value=""
                                onChange={(e) => {
                                    insertField(key, e.target.value);
                                    e.target.value = '';
                                }}
                            >
                                <option value="">insert field…</option>
                                {availableFields.map((field) => (
                                    <option key={field} value={field}>
                                        {`{{ item.${field} }}`}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
