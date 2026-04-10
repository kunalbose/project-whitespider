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

        return NextResponse.json({
            success: true,
            count: data.length,
            data,
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