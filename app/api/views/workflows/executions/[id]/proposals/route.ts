import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
    applyWriteProposals,
    discardWriteProposals,
    revertWriteProposals,
} from '@/lib/workflow/writeProposals';

/** The staged writes for an execution — what the approval diff renders from. */
export async function GET(
    _req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    const { data, error } = await supabase
        .from('workflow_write_proposals')
        .select('*')
        .eq('execution_id', id)
        .order('id');

    if (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }

    return NextResponse.json({ success: true, count: data.length, data });
}

/**
 * Approve, reject, or undo an execution's staged writes.
 *
 *   POST { "action": "apply" | "discard" | "revert" }
 *
 * `apply` is the approval step; `revert` is the undo that capturing previous_value
 * at propose time makes possible.
 */
export async function POST(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const executionId = Number(id);

    if (!Number.isFinite(executionId)) {
        return NextResponse.json(
            { success: false, error: 'Invalid execution id' },
            { status: 400 }
        );
    }

    let action: string;

    try {
        ({ action } = await req.json());
    } catch {
        return NextResponse.json(
            { success: false, error: 'Request body must be JSON' },
            { status: 400 }
        );
    }

    try {
        switch (action) {
            case 'apply':
                return NextResponse.json({ success: true, result: await applyWriteProposals(executionId) });
            case 'discard':
                return NextResponse.json({ success: true, result: await discardWriteProposals(executionId) });
            case 'revert':
                return NextResponse.json({ success: true, result: await revertWriteProposals(executionId) });
            default:
                return NextResponse.json(
                    { success: false, error: "action must be 'apply', 'discard', or 'revert'" },
                    { status: 400 }
                );
        }
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err?.message ?? 'Action failed' },
            { status: 500 }
        );
    }
}
