import { runTool } from '@/tool-host/executor';
import { ToolResult } from '@/tool-host/types';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * THE SWAP POINT.
 *
 * Nothing above this function knows how a tool is implemented. Today the default path
 * is an in-process call into the Tool Host. Set TOOL_HOST_URL and the exact same call
 * goes over HTTP to a standalone host instead — no other file changes.
 *
 * Never throws for tool-level failures; always returns the envelope.
 */
export async function executeTool(
    name: string,
    args: any,
    opts: { timeoutMs?: number } = {}
): Promise<ToolResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const hostUrl = process.env.TOOL_HOST_URL;

    if (!hostUrl) {
        return runTool(name, args, { timeoutMs });
    }

    try {
        const res = await fetch(`${hostUrl.replace(/\/$/, '')}/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.TOOL_HOST_API_KEY
                    ? { Authorization: `Bearer ${process.env.TOOL_HOST_API_KEY}` }
                    : {}),
            },
            body: JSON.stringify({ tool: name, arguments: args ?? {} }),
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!res.ok) {
            return {
                success: false,
                error: {
                    message: `Tool host returned HTTP ${res.status}`,
                    code: 'TRANSPORT_ERROR',
                },
            };
        }

        return (await res.json()) as ToolResult;
    } catch (err: any) {
        return {
            success: false,
            error: {
                message: err?.message || 'Could not reach the tool host',
                code: err?.name === 'TimeoutError' ? 'TIMEOUT' : 'TRANSPORT_ERROR',
            },
        };
    }
}
