import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const viewId = searchParams.get('viewId');

    // workflows(name) is an embedded read over the workflow_id FK. Null for ad-hoc canvas
    // runs and for anything predating saved workflows, so the UI must tolerate its absence.
    const { data, error } = await supabase
        .from('workflow_executions')
        .select('id, started_at, status, is_test, workflow_version, workflows(name)')
        .eq('view_id', viewId)
        .order('started_at', { ascending: false })
        .limit(50);

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data });
}