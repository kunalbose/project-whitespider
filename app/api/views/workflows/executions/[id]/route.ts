import { supabase } from '@/lib/supabase';

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    const { id } = params;

    const { data, error } = await supabase
        .from('workflow_executions')
        .select('snapshot')
        .eq('id', id)
        .single();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
        snapshot: data.snapshot,
    });
}