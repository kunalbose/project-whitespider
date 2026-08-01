import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** One saved workflow, graph included. */
export async function GET(_req: Request, context: { params: Promise<{ workflowId: string }> }) {
    const { workflowId } = await context.params;

    const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
}

/**
 * Save.
 *
 * `version` is deliberately not settable here — the workflows_touch trigger owns it, and
 * only bumps when the graph actually changed, so renaming does not invent a version with no
 * new definition behind it.
 */
export async function PATCH(req: Request, context: { params: Promise<{ workflowId: string }> }) {
    const { workflowId } = await context.params;

    let body: { name?: string; description?: string; graph?: any; status?: string };

    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Request body must be JSON' }, { status: 400 });
    }

    const patch: Record<string, any> = {};
    // A cleared name field is not a request to erase the name — the row keeps whatever it
    // has, which for an unnamed workflow is the generated default.
    if (body.name?.trim()) patch.name = body.name.trim();
    if (body.description !== undefined) patch.description = body.description;
    if (body.graph !== undefined) patch.graph = body.graph;
    if (body.status !== undefined) patch.status = body.status;

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('workflows')
        .update(patch)
        .eq('id', workflowId)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

/** Executions survive this — workflow_executions.workflow_id is on delete set null. */
export async function DELETE(_req: Request, context: { params: Promise<{ workflowId: string }> }) {
    const { workflowId } = await context.params;

    const { error } = await supabase.from('workflows').delete().eq('id', workflowId);

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
