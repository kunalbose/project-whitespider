/**
 * The Tool Host contract.
 *
 * A tool returns its result directly and throws on failure. The executor owns all
 * envelope wrapping, so tool authors never write {success, error} boilerplate.
 */

export interface ToolContext {
    toolName: string;
    signal?: AbortSignal;
}

export interface ToolModule {
    execute(args: any, ctx: ToolContext): Promise<any>;
}

export interface ToolError {
    message: string;
    code: string;
}

export type ToolResult =
    | { success: true; result: any }
    | { success: false; error: ToolError };

/** Thrown by a tool (or the executor) to control the error code in the envelope. */
export class ToolFailure extends Error {
    code: string;

    constructor(message: string, code = 'TOOL_ERROR') {
        super(message);
        this.name = 'ToolFailure';
        this.code = code;
    }
}

/** A row of the Supabase `tools` registry. */
export interface ToolRecord {
    name: string;
    display_name: string;
    description: string | null;
    category: string;
    input_schema: any;
    output_schema: any;
    implementation: string;
    runtime: 'local' | 'http';
    endpoint: string | null;
    supports_batch: boolean;
    version: number;
    status: string;
}
