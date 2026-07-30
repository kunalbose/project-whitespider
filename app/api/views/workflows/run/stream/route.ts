import { executeFlow } from '@/lib/workflow/engine';
import { Node } from '@xyflow/react';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    const { nodes, edges, viewId } = await req.json();

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

                const { data: row } = await supabase
                    .from('list_leads_membership')
                    .select('*')
                    .eq('id', startNode.data.selectedRowId)
                    .single();

                if (!row) throw new Error('Selected row not found');

                let context = {
                    data: [row.schema],
                };

                const { data: execution, error: executionError } = await supabase
                    .from('workflow_executions')
                    .insert({
                        view_id: viewId,
                        is_test: true,
                        status: 'running',
                        snapshot: null,
                        started_at: new Date().toISOString(),
                        list_lead_id: row.id,
                    })
                    .select()
                    .single();

                if (!execution) {
                    throw new Error(
                        `Failed to create execution: ${executionError?.message ?? 'unknown error'}`
                    );
                }

                executionId = execution.id;

                await executeFlow(startNode, context, workingNodes, edges, emit);

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