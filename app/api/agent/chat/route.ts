import { runAgentTurn, type AgentEvent, type ChatMessage } from '@/lib/agent/conversation';

/**
 * One turn of the conversation agent, streamed.
 *
 * Same SSE shape as /api/views/workflows/run/stream — `data: {...}\n\n`, one JSON object
 * per event — so the client reads it with the same loop.
 */
export async function POST(req: Request) {
    let viewId: number;
    let messages: ChatMessage[];

    try {
        ({ viewId, messages } = await req.json());
    } catch {
        return Response.json({ error: 'Request body must be JSON' }, { status: 400 });
    }

    if (!viewId || !Array.isArray(messages) || messages.length === 0) {
        return Response.json({ error: 'viewId and a non-empty messages array are required' }, { status: 400 });
    }

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            let closed = false;

            const emit = (event: AgentEvent) => {
                if (closed) return;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };

            try {
                await runAgentTurn(Number(viewId), messages, emit);
            } catch (err: any) {
                emit({ error: err?.message || 'The agent failed' });
            } finally {
                closed = true;
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
