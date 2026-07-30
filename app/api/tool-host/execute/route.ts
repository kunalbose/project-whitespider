import { NextResponse } from 'next/server';
import { runTool } from '@/tool-host/executor';

/**
 * The Tool Host, exposed over HTTP.
 *
 * The engine does NOT call this — it calls executeTool() in-process, since a
 * self-request would be pointless. This route exists to make the wire contract real
 * and curl-testable, and it is precisely the surface a standalone host will replace.
 *
 *   POST { "tool": "echo", "arguments": { "hello": "world" } }
 *   200  { "success": true,  "result": { "received": { "hello": "world" } } }
 *   200  { "success": false, "error": { "message": "...", "code": "BAD_INPUT" } }
 *
 * Tool-level failures are 200s with success:false. Only malformed requests are 4xx.
 */
export async function POST(req: Request) {
    let body: any;

    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { success: false, error: { message: 'Request body must be JSON', code: 'BAD_REQUEST' } },
            { status: 400 }
        );
    }

    const { tool, arguments: args } = body ?? {};

    if (typeof tool !== 'string' || tool.trim() === '') {
        return NextResponse.json(
            { success: false, error: { message: "'tool' is required", code: 'BAD_REQUEST' } },
            { status: 400 }
        );
    }

    const result = await runTool(tool, args ?? {});

    return NextResponse.json(result);
}
