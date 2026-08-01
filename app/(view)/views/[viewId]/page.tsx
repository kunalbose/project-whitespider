'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './ViewPage.module.css';
import { useParams } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import WorkflowsPanel from '@/components/workflow/WorkflowsPanel';
import ExecutionsViewer from '@/components/workflow/ExecutionViewer';
import AgentChat from '@/components/agent/AgentChat';

export default function ViewPage() {
    const params = useParams();
    const viewId = params.viewId as string;

    const [columns, setColumns] = useState<any[]>([]);
    const [rows, setRows] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'table' | 'workflow' | 'executions' | 'agent'>('table');
    // Set when the Agent tab hands off a finished test run, so Executions opens on it.
    const [openExecutionId, setOpenExecutionId] = useState<string | null>(null);

    const parentRef = useRef<HTMLDivElement>(null);

    function flattenSchema(schema: any, columns: any[]) {
        const flattened: Record<string, any> = {};

        columns.forEach((col) => {
            const column = col.columns;
            let value = '';

            if (column.column_type === 'schema') {
                value = schema?.[column.column_name];
            } else if (column.column_type === 'extra_field') {
                value = schema?.extra_fields?.[column.column_name];
            } else if (column.column_type === 'internal_enrichment') {
                console.log(column, schema, 'column');
                value = schema?.internal_enrichment?.[column.column_name];
            } else if (column.column_type === 'external_enrichment') {
                value = schema?.external_enrichment?.[column.column_name];
            }

            flattened[column.column_name] = value;
        });

        return flattened;
    }

    useEffect(() => {
        fetchViewData();
    }, [viewId]);

    async function fetchViewData() {
        const { data: cols } = await supabase
            .from('view_columns')
            .select(`
                column_id,
                column_order,
                width,
                columns (*)
            `)
            .eq('view_id', viewId)
            .eq('is_visible', true)
            .order('column_order');

        setColumns(cols || []);

        const { data: view } = await supabase
            .from('list_views')
            .select('lead_list_id')
            .eq('id', viewId)
            .single();

        const listId = view?.lead_list_id;

        const { data: rowsData } = await supabase
            .from('list_leads_membership')
            .select('*')
            .eq('list_id', listId);

        setRows(rowsData || []);
    }

    // 🔥 Virtualization
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 44,
        overscan: 10,
    });

    const virtualRows = rowVirtualizer.getVirtualItems();


    const gridTemplate = columns
        .map((col) => `${col.width || 220}px`)
        .join(' ');

    const totalWidth = columns.reduce(
        (acc, col) => acc + (col.width || 220),
        0
    );

    return (
        <div className={styles.container}>
            {/* HEADER */}
            <div className={styles.header}>
                <h2>View</h2>
                <div className={styles.tabs}>
                    <button onClick={() => setActiveTab('table')}>Table</button>
                    <button onClick={() => setActiveTab('agent')}>Agent</button>
                    <button onClick={() => setActiveTab('workflow')}>Workflow</button>
                    <button onClick={() => setActiveTab('executions')}>Executions</button>
                </div>
            </div>

            {activeTab === 'table' && (
                <div className={styles.tableWrapper} ref={parentRef}>

                    {/* GRID HEADER */}
                    <div
                        className={styles.gridHeader}
                        style={{
                            gridTemplateColumns: gridTemplate,
                            width: totalWidth,
                        }}
                    >
                        {columns.map((col) => (
                            <div key={col.column_id} className={styles.cellHeader}>
                                {col.columns.column_name}
                            </div>
                        ))}
                    </div>

                    {/* VIRTUALIZED BODY */}
                    <div
                        style={{
                            height: rowVirtualizer.getTotalSize(),
                            width: totalWidth,
                            position: 'relative',
                        }}
                    >
                        {virtualRows.map((virtualRow) => {
                            const row = rows[virtualRow.index];
                            const flat = flattenSchema(row.schema, columns);

                            return (
                                <div
                                    key={row.id}
                                    className={styles.row}
                                    style={{
                                        transform: `translateY(${virtualRow.start}px)`,
                                        gridTemplateColumns: gridTemplate,
                                        width: totalWidth,
                                    }}
                                >
                                    {columns.map((col) => {
                                        const key = col.columns.column_name;

                                        return (
                                            <div key={key} className={styles.cell}>
                                                {flat[key] ?? '-'}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'agent' && (
                <div className={styles.tabPanel}>
                    <AgentChat
                        viewId={viewId}
                        onOpenExecution={(executionId) => {
                            setOpenExecutionId(executionId);
                            setActiveTab('executions');
                        }}
                    />
                </div>
            )}

            {activeTab === 'workflow' && (
                <div className={styles.tabPanel}>
                    <WorkflowsPanel viewId={viewId} rows={rows} />
                </div>
            )}

            {activeTab === 'executions' && (
                <div className={styles.tabPanel}>
                    <ExecutionsViewer
                        viewId={viewId}
                        rows={rows}
                        initialExecutionId={openExecutionId}
                    />
                </div>
            )}
        </div>
    );
}