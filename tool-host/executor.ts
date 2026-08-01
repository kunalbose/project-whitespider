import { supabase } from '@/lib/supabase';
import { toolRegistry } from './registry';
import { ToolContext, ToolFailure, ToolRecord, ToolResult } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The Tool Host. Looks a tool up in the Supabase registry, invokes it, and normalizes
 * everything — including thrown errors — into the wire envelope.
 *
 * This function never throws for tool-level failures. Callers branch on `success`.
 */
export async function runTool(
    name: string,
    args: any,
    opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<ToolResult> {
    try {
        const tool = await loadToolRecord(name);
        validateArguments(tool, args);

        // The registry row wins over the caller. A tool that scrapes four pages and calls a
        // model cannot finish inside the 30s default, and raising that default would let
        // every future tool hang for two minutes. The envelope belongs with the tool.
        const timeoutMs = tool.timeout_ms ?? opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const signal = opts.signal ?? AbortSignal.timeout(timeoutMs);
        const ctx: ToolContext = { toolName: tool.name, signal };

        const result =
            tool.runtime === 'http'
                ? await runRemote(tool, args, signal)
                : await runLocal(tool, args, ctx);

        return { success: true, result };
    } catch (err: any) {
        return {
            success: false,
            error: {
                message: err?.message || 'Tool execution failed',
                code: err instanceof ToolFailure ? err.code : errorCodeFor(err),
            },
        };
    }
}

async function loadToolRecord(name: string): Promise<ToolRecord> {
    if (typeof name !== 'string' || name.trim() === '') {
        throw new ToolFailure('A tool name is required', 'BAD_INPUT');
    }

    const { data, error } = await supabase
        .from('tools')
        .select('*')
        .eq('name', name)
        .eq('status', 'active')
        .maybeSingle();

    if (error) {
        throw new ToolFailure(`Registry lookup failed: ${error.message}`, 'REGISTRY_ERROR');
    }

    if (!data) {
        throw new ToolFailure(`Unknown or inactive tool: '${name}'`, 'TOOL_NOT_FOUND');
    }

    return data as ToolRecord;
}

/**
 * Shallow validation only: required top-level keys must be present. Full JSON Schema
 * validation is not worth a dependency yet — tools validate their own inputs.
 */
function validateArguments(tool: ToolRecord, args: any) {
    const required: unknown = tool.input_schema?.required;
    if (!Array.isArray(required) || required.length === 0) return;

    const provided = args ?? {};
    const missing = required.filter(
        (key) => typeof key === 'string' && provided[key] === undefined
    );

    if (missing.length > 0) {
        throw new ToolFailure(
            `Missing required argument${missing.length > 1 ? 's' : ''} for '${tool.name}': ${missing.join(', ')}`,
            'BAD_INPUT'
        );
    }
}

async function runLocal(tool: ToolRecord, args: any, ctx: ToolContext) {
    const importer = toolRegistry[tool.implementation];

    if (!importer) {
        throw new ToolFailure(
            `Tool '${tool.name}' points at implementation '${tool.implementation}', which is not in tool-host/registry.ts`,
            'IMPLEMENTATION_MISSING'
        );
    }

    const mod = await importer();

    if (typeof mod?.execute !== 'function') {
        throw new ToolFailure(
            `Implementation '${tool.implementation}' does not export an execute() function`,
            'IMPLEMENTATION_INVALID'
        );
    }

    return mod.execute(args ?? {}, ctx);
}

/**
 * The entire migration path to a standalone host: flip a row to runtime='http' and
 * point `endpoint` at it. The wire contract is identical in both directions.
 */
async function runRemote(tool: ToolRecord, args: any, signal: AbortSignal) {
    const res = await fetch(tool.endpoint!, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(process.env.TOOL_HOST_API_KEY
                ? { Authorization: `Bearer ${process.env.TOOL_HOST_API_KEY}` }
                : {}),
        },
        body: JSON.stringify({ tool: tool.name, arguments: args ?? {} }),
        signal,
    });

    if (!res.ok) {
        throw new ToolFailure(
            `Remote tool '${tool.name}' returned HTTP ${res.status}`,
            'TRANSPORT_ERROR'
        );
    }

    const body = (await res.json()) as ToolResult;

    if (!body?.success) {
        throw new ToolFailure(
            body?.error?.message || 'Remote tool failed',
            body?.error?.code || 'TOOL_ERROR'
        );
    }

    return body.result;
}

function errorCodeFor(err: any) {
    if (err?.name === 'TimeoutError') return 'TIMEOUT';
    if (err?.name === 'AbortError') return 'ABORTED';
    return 'TOOL_ERROR';
}
