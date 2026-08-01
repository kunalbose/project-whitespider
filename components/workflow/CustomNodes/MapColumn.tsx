import { useEffect, useRef, useState } from 'react';
import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { supabase } from '@/lib/supabase';
import { NodeData } from '../Workflow';

type MapColumnConfig = {
    label?: string;
    mode?: 'existing' | 'new';
    column?: string;
    value?: string;
    skipIfPopulated?: boolean;
    rows?: any[];
};

type MapColumnNodeData = Node<NodeData<MapColumnConfig>, 'map_column'>;

/** Human label for the container a value ends up in. */
const TARGET_LABELS: Record<string, string> = {
    schema: 'native field',
    extra_field: 'extra field',
    internal_enrichment: 'internal enrichment',
    external_enrichment: 'external enrichment',
};

const MapColumnNode = ({ id, data, selected }: NodeProps<MapColumnNodeData>) => {
    return (
        <div className="group relative min-w-[220px]">
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
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {data.label || 'Map to Column'}
                        </span>
                    </div>
                </div>

                <div className="p-4 flex flex-col items-center justify-center gap-1">
                    <span className="text-xs text-slate-300 font-mono">
                        {data.column || 'no column'}
                    </span>
                    {data.mode === 'new' && (
                        <span className="text-[10px] text-amber-400/80">new column</span>
                    )}
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
                className="w-3 h-3 bg-amber-500 border-2 border-slate-900 !-right-[7px]"
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

export default MapColumnNode;

type MapColumnConfigProps = {
    node: Node<NodeData<MapColumnConfig>, 'map_column'>;
    updateNodeData: (nodeId: string, updater: (data: any) => any) => void;
};

type ColumnRow = {
    column_name: string;
    column_raw_name: string | null;
    column_type: string;
};

export const MapColumnNodeConfig = ({ node, updateNodeData }: MapColumnConfigProps) => {
    const valueRef = useRef<HTMLInputElement | null>(null);
    const [columns, setColumns] = useState<ColumnRow[]>([]);
    const [loading, setLoading] = useState(true);

    const mode = node.data.mode ?? 'existing';
    const listId = node.data.rows?.[0]?.list_id;

    // Fields available on the incoming item, for the template helper. The engine feeds
    // row.schema as the item, so offer the schema's keys — not the membership wrapper's.
    const sampleItem = node.data.rows?.[0]?.schema ?? node.data.rows?.[0];
    const availableFields = sampleItem ? Object.keys(sampleItem) : [];

    useEffect(() => {
        if (!listId) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            const { data } = await supabase
                .from('columns')
                .select('column_name, column_raw_name, column_type')
                .eq('list_id', listId)
                .order('column_order');

            if (!cancelled) {
                setColumns(data ?? []);
                setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [listId]);

    const set = (key: string, value: any) => {
        updateNodeData(node.id, (prev) => ({ ...prev, [key]: value }));
    };

    const insertField = (field: string) => {
        if (!field) return;
        const current = String(node.data.value ?? '');
        const at = valueRef.current?.selectionStart ?? current.length;
        set('value', current.slice(0, at) + `{{ item.${field} }}` + current.slice(at));
    };

    const selected = columns.find(
        (c) => c.column_raw_name === node.data.column || c.column_name === node.data.column
    );

    return (
        <div className="flex flex-col gap-4 p-2 overflow-auto max-h-full">
            <header className="border-b border-slate-700 pb-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    Column Mapping
                </h3>
            </header>

            {/* Existing vs new column */}
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Write to</label>
                <div className="flex gap-2">
                    {(['existing', 'new'] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => {
                                set('mode', m);
                                set('column', '');
                            }}
                            className={`flex-1 px-3 py-2 rounded-md text-xs cursor-pointer transition-colors border ${mode === m
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                                }`}
                        >
                            {m === 'existing' ? 'Existing column' : 'New column'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Column picker */}
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                    Column <span className="text-red-400">*</span>
                </label>

                {mode === 'existing' ? (
                    <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white outline-none cursor-pointer"
                        value={node.data.column ?? ''}
                        onChange={(e) => set('column', e.target.value)}
                        disabled={loading}
                    >
                        <option value="">
                            {loading ? 'Loading columns…' : 'Select a column…'}
                        </option>
                        {columns.map((c) => (
                            <option key={c.column_name} value={c.column_raw_name || c.column_name}>
                                {(c.column_raw_name || c.column_name)} — {TARGET_LABELS[c.column_type] ?? c.column_type}
                            </option>
                        ))}
                    </select>
                ) : (
                    <>
                        <input
                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="e.g. company_size"
                            value={node.data.column ?? ''}
                            onChange={(e) => set('column', e.target.value)}
                        />
                        <p className="text-[11px] text-slate-500">
                            Created as an <span className="text-amber-400">internal enrichment</span> on first approval.
                        </p>
                    </>
                )}

                {mode === 'existing' && selected && (
                    <p className="text-[11px] text-slate-500">
                        Overwrites the {TARGET_LABELS[selected.column_type] ?? selected.column_type}.
                    </p>
                )}
            </div>

            {/* Value */}
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                    Value <span className="text-red-400">*</span>
                </label>
                <input
                    ref={valueRef}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="{{ item.employee_count }}"
                    value={node.data.value ?? ''}
                    onChange={(e) => set('value', e.target.value)}
                />

                {availableFields.length > 0 && (
                    <select
                        className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-[11px] text-slate-400 cursor-pointer outline-none"
                        value=""
                        onChange={(e) => {
                            insertField(e.target.value);
                            e.target.value = '';
                        }}
                    >
                        <option value="">insert field…</option>
                        {availableFields.map((field) => (
                            <option key={field} value={field}>{`{{ item.${field} }}`}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Skip toggle */}
            <label className="flex items-start gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    className="mt-0.5 cursor-pointer"
                    checked={Boolean(node.data.skipIfPopulated)}
                    onChange={(e) => set('skipIfPopulated', e.target.checked)}
                />
                <span className="text-xs text-slate-400">
                    Skip if the column already has a value
                    <span className="block text-[11px] text-slate-500">
                        Fills blanks only, leaving existing data alone.
                    </span>
                </span>
            </label>

            <p className="text-[11px] text-slate-500 border-t border-slate-800 pt-3">
                Test runs stage the change for review — nothing is written to the list until
                you approve it in the Executions tab.
            </p>
        </div>
    );
};
