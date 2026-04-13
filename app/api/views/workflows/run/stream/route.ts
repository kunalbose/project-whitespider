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

                console.log(executionError, 'execute');

                if (!execution) throw new Error('Failed to create execution');

                await executeFlow(startNode, context, workingNodes, edges, emit);

                // await supabase
                //     .from('workflow_executions')
                //     .update({
                //         status: 'completed',
                //         completed_at: new Date().toISOString(),
                //         snapshot: {
                //             nodes: workingNodes,
                //             edges,
                //         },
                //     })
                //     .eq('id', execution.id);

                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
                );
            } catch (err: any) {
                const errorMessage = err?.message || 'Execution failed';

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