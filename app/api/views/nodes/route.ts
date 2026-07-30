import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const category = searchParams.get('category');
        const excludeCategory = searchParams.get('excludeCategory');
        const search = searchParams.get('search');

        let query = supabase
            .from('node_types')
            .select(`
        id,
        name,
        key,
        description,
        category,
        config_schema,
        input_schema,
        output_schema
      `)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (category) {
            query = query.eq('category', category);
        }

        if (search) {
            query = query.or(
                `name.ilike.%${search}%,key.ilike.%${search}%,description.ilike.%${search}%`
            );
        }

        if (excludeCategory) {
            query = query.or(
                `category.is.null,category.neq.${excludeCategory}`
            );
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase error:', error);

            return NextResponse.json(
                {
                    success: false,
                    error: 'Failed to fetch node types',
                    details: error.message,
                },
                { status: 500 }
            );
        }

        // Registry tools are palette entries too. They all render through the single
        // generic `tool` node, so a new tool needs no code here or in the UI.
        let toolQuery = supabase
            .from('tools')
            .select('id, name, display_name, description, category, input_schema, output_schema')
            .eq('status', 'active')
            .order('display_name', { ascending: true });

        // Tools never carry the 'Execution' category, so the "first node must be an
        // Execution node" rule keeps working: filtering to it excludes them entirely.
        if (category) {
            toolQuery = toolQuery.eq('category', category);
        }

        if (search) {
            toolQuery = toolQuery.or(
                `display_name.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`
            );
        }

        if (excludeCategory) {
            toolQuery = toolQuery.neq('category', excludeCategory);
        }

        const { data: tools, error: toolsError } = await toolQuery;

        if (toolsError) {
            console.error('Supabase error (tools):', toolsError);

            return NextResponse.json(
                {
                    success: false,
                    error: 'Failed to fetch tools',
                    details: toolsError.message,
                },
                { status: 500 }
            );
        }

        const toolEntries = (tools ?? []).map((t) => ({
            id: `tool:${t.id}`,
            key: 'tool',
            name: t.display_name,
            description: t.description,
            category: t.category,
            tool_name: t.name,
            config_schema: null,
            input_schema: t.input_schema,
            output_schema: t.output_schema,
        }));

        const merged = [...data, ...toolEntries];

        return NextResponse.json({
            success: true,
            count: merged.length,
            data: merged,
        });

    } catch (err) {
        console.error('API error:', err);

        return NextResponse.json(
            {
                success: false,
                error: err instanceof Error ? err.message : 'Unexpected server error',
            },
            { status: 500 }
        );
    }
}