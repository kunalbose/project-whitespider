import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * A view's saved workflows.
 *
 * Sits alongside the existing `executions/` and `run/` children. Next.js matches static
 * segments before dynamic ones, and workflow ids are numeric, so `[workflowId]` can never
 * shadow either of those words.
 */

/** The list, without graphs — the sidebar only needs names and freshness. */
export async function GET(req: Request) {
    const viewId = new URL(req.url).searchParams.get('viewId');

    if (!viewId) {
        return NextResponse.json({ success: false, error: 'viewId is required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('workflows')
        .select('id, name, description, version, status, created_at, updated_at')
        .eq('view_id', viewId)
        .order('updated_at', { ascending: false });

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

/** `Erin - Elevate` -> `erin-elevate`, capped so a long list name cannot dominate the label. */
function slug(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24)
        .replace(/-$/, '');
}

/**
 * What a workflow is called when the user saves without naming it: the list, the view, and
 * the next free number — `erin-elevate-new-view-workflow-1`.
 *
 * Counting rows is only the starting guess; names are not unique, and a user is free to name
 * something `...-workflow-2` by hand, so the loop below steps past whatever is taken.
 */
async function defaultName(viewId: number) {
    const { data: view } = await supabase
        .from('list_views')
        .select('name, lead_lists(name)')
        .eq('id', viewId)
        .single();

    const listName = (view as any)?.lead_lists?.name as string | undefined;

    const base =
        [listName, view?.name]
            .filter(Boolean)
            .map((part) => slug(String(part)))
            .filter(Boolean)
            .concat('workflow')
            .join('-') || 'workflow';

    const { data: existing } = await supabase.from('workflows').select('name').eq('view_id', viewId);

    const taken = new Set((existing ?? []).map((w) => w.name));
    let n = (existing?.length ?? 0) + 1;
    while (taken.has(`${base}-${n}`)) n++;

    return `${base}-${n}`;
}

export async function POST(req: Request) {
    let body: { viewId?: number; name?: string; description?: string; graph?: any };

    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Request body must be JSON' }, { status: 400 });
    }

    if (!body.viewId) {
        return NextResponse.json({ success: false, error: 'viewId is required' }, { status: 400 });
    }

    // Name is optional: an unnamed workflow gets a generated one rather than blocking the
    // user behind a naming step before they have built anything.
    const name = body.name?.trim() || (await defaultName(body.viewId));

    const { data, error } = await supabase
        .from('workflows')
        .insert({
            view_id: body.viewId,
            name,
            description: body.description ?? null,
            // An empty graph is a valid starting point — the canvas opens on its add-node button.
            graph: body.graph ?? { nodes: [], edges: [] },
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}
