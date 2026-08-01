import { executeFlow } from '@/lib/workflow/engine';
import { Node } from '@xyflow/react';
import { supabase } from '@/lib/supabase';
import { applyWriteProposals } from '@/lib/workflow/writeProposals';

/**
 * Which rows this run processes.
 *
 * `rowLimit` 1 is the canvas path: exactly the row the start node picked, nothing else.
 * Higher is a batch across the view's list, with the picked row leading so the run starts
 * on something the user was already looking at.
 */
async function resolveRows(viewId: number, selectedRowId: number | null, rowLimit: number) {
    if (rowLimit <= 1) {
        const { data: row } = await supabase
            .from('list_leads_membership')
            .select('*')
            .eq('id', selectedRowId)
            .single();

        if (!row) throw new Error('Selected row not found');
        return [row];
    }

    const { data: view } = await supabase
        .from('list_views')
        .select('lead_list_id')
        .eq('id', viewId)
        .single();

    if (!view?.lead_list_id) throw new Error('View has no list');

    const { data: rows, error } = await supabase
        .from('list_leads_membership')
        .select('*')
        .eq('list_id', view.lead_list_id)
        .order('id')
        .limit(rowLimit);

    if (error) throw new Error(`Could not load rows: ${error.message}`);
    if (!rows?.length) throw new Error('This list has no rows');

    // Lead with the picked row when there is one, so the batch opens on a row the user
    // has already seen. Order is otherwise by id.
    const lead = rows.findIndex((r) => String(r.id) === String(selectedRowId));
    if (lead > 0) rows.unshift(...rows.splice(lead, 1));

    return rows;
}

export async function POST(req: Request) {
    // rowLimit = 1 keeps the canvas behaviour (run the row the start node picked). Anything
    // higher is a batch: the start node's row leads, and the rest of the list follows.
    const { nodes, edges, viewId, isTest = true, rowLimit = 1, workflowId = null } = await req.json();

    // 🔥 deep clone for snapshot mutation
    const workingNodes = JSON.parse(JSON.stringify(nodes));

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const emit = (data: any) => {
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
            };

            // Hoisted so the catch below can mark the row terminal.
            let executionId: string | null = null;

            try {
                const startNode = workingNodes.find((n: Node) => n.type === 'test');
                if (!startNode) throw new Error('No start node (test) found');

                const rows = await resolveRows(viewId, startNode.data.selectedRowId, rowLimit);
                if (rows.length === 0) throw new Error('No rows to run against');

                // Read the version now rather than trusting a client-supplied one: the run
                // must record the definition that actually existed when it started.
                let workflowVersion: number | null = null;
                if (workflowId) {
                    const { data: workflow } = await supabase
                        .from('workflows')
                        .select('version')
                        .eq('id', workflowId)
                        .single();

                    workflowVersion = workflow?.version ?? null;
                }

                const context = {
                    data: rows.map((r) => r.schema),
                    leadIds: rows.map((r) => Number(r.id)),
                };

                const { data: execution, error: executionError } = await supabase
                    .from('workflow_executions')
                    .insert({
                        view_id: viewId,
                        workflow_id: workflowId,
                        workflow_version: workflowVersion,
                        is_test: isTest,
                        status: 'running',
                        snapshot: null,
                        started_at: new Date().toISOString(),
                        // A batch belongs to no single lead. Null also sidesteps
                        // idx_active_execution, which exists to stop one lead being re-run
                        // while a run is live -- still enforced for single-row runs below.
                        list_lead_id: rows.length === 1 ? rows[0].id : null,
                    })
                    .select()
                    .single();

                if (!execution) {
                    throw new Error(
                        `Failed to create execution: ${executionError?.message ?? 'unknown error'}`
                    );
                }

                executionId = execution.id;

                // Announced before the flow runs so a caller can link to the run while it
                // is still going, and still has the id if the flow then fails.
                emit({ executionId: execution.id, rowCount: rows.length });

                await executeFlow(startNode, context, workingNodes, edges, emit, {
                    executionId: Number(execution.id),
                    // Only a fallback: executeFlow rebinds this per item from context.leadIds.
                    listLeadId: Number(rows[0].id),
                    isTest,
                });

                // Test runs leave mapper writes staged for approval. A real run commits
                // them here, once, after the whole flow has succeeded — so a failure
                // halfway through does not half-apply the row.
                if (!isTest) {
                    const applied = await applyWriteProposals(Number(execution.id));
                    emit({ applied });
                }

                // Executions MUST reach a terminal status. There is a partial unique index
                // (idx_active_execution on list_lead_id, view_id) over active rows, so a row
                // left at 'running' permanently blocks every re-run of that lead in this view.
                await supabase
                    .from('workflow_executions')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        snapshot: {
                            nodes: workingNodes,
                            edges,
                        },
                    })
                    .eq('id', execution.id);

                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
                );
            } catch (err: any) {
                const errorMessage = err?.message || 'Execution failed';

                // Same reason: a failed run must not leave the execution stuck at 'running'.
                if (executionId) {
                    await supabase
                        .from('workflow_executions')
                        .update({
                            status: 'error',
                            completed_at: new Date().toISOString(),
                            snapshot: {
                                nodes: workingNodes,
                                edges,
                            },
                        })
                        .eq('id', executionId);
                }

                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({
                            error: errorMessage,
                        })}\n\n`
                    )
                );
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Content-Encoding': 'none',
        },
    });
}