import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { executeNode, getExecutionOrder } from '@/lib/workflow/engine';
import { Node } from '@xyflow/react';

export async function POST(req: Request) {
    const { nodes, edges, viewId } = await req.json();

    const startNode = nodes.find((n: any) => n.type === 'test');

    if (!startNode) {
        return NextResponse.json({ error: 'No test node' }, { status: 400 });
    }

    // 2. get row
    const { data: row } = await supabase
        .from('list_leads_membership')
        .select('*')
        .eq('id', startNode.data.selectedRowId)
        .single();

    // 3. create execution
    const { data: execution } = await supabase
        .from('workflow_executions')
        .insert({
            view_id: viewId,
            status: 'running',
            list_lead_id: row.id,
            started_at: new Date().toISOString(),
        })
        .select()
        .single();

    let context = {
        data: row.schema,
        executionId: execution.id,
        listLeadId: row.id,
    };

    const executionOrder = getExecutionOrder(nodes, edges, startNode.id);

    for (const node of executionOrder) {
        const startTime = new Date();

        try {
            const output = await executeNode(node as Node, context.data);

            await supabase.from('node_executions').insert({
                execution_id: execution.id,
                node_id: node?.id,
                input: context.data,
                output,
                status: 'success',
                started_at: startTime,
                completed_at: new Date(),
                list_lead_id: row.id,
            });

            context.data = output;
        } catch (err: any) {
            await supabase.from('node_executions').insert({
                execution_id: execution.id,
                node_id: node?.id,
                input: context.data,
                status: 'error',
                error: err.message,
                started_at: startTime,
                completed_at: new Date(),
                list_lead_id: row.id,
            });

            await supabase
                .from('workflow_executions')
                .update({ status: 'failed', completed_at: new Date() })
                .eq('id', execution.id);

            return NextResponse.json({ error: err.message });
        }
    }

    await supabase
        .from('workflow_executions')
        .update({ status: 'completed', completed_at: new Date() })
        .eq('id', execution.id);

    return NextResponse.json({ success: true, data: context.data });
}