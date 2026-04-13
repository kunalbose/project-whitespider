import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const viewId = searchParams.get('viewId');

    const { data, error } = await supabase
        .from('workflow_executions')
        .select('id, started_at, status, is_test')
        .eq('view_id', viewId)
        .order('started_at', { ascending: false })
        .limit(50);

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data });
}