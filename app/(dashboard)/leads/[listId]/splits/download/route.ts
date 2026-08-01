import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface Column {
    id: number;
    column_name: string;
    column_order: number;
    column_type: string;
    column_raw_name: string;
}

function generateRow(lead_membership_id: number, schema: any, columns: Column[]): string {
    const values: string[] = [];

    // Add lead_membership_id first
    values.push(`"${lead_membership_id}"`);

    for (const col of columns) {
        let value = '';

        if (col.column_type === 'schema') {
            value = schema[col.column_name];
        } else if (col.column_type === 'extra_field') {
            value = schema.extra_fields?.[col.column_name];
        } else if (col.column_type === 'internal_enrichment') {
            value = schema.internal_enrichment?.[col.column_name];
        } else if (col.column_type === 'external_enrichment') {
            value = schema.external_enrichment?.[col.column_name];
        }

        // Escape quotes and wrap in quotes
        value = String(value || '').replace(/"/g, '""');
        values.push(`"${value}"`);
    }

    return values.join(',');
}

export async function GET(
    request: NextRequest,
    _context: { params: Promise<{ listId: string }> }
) {
    const searchParams = request.nextUrl.searchParams;
    const clayTableId = searchParams.get('clayTableId');

    if (!clayTableId) {
        return NextResponse.json({ error: 'clayTableId required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch all leads for this clay_table using pagination
    const BATCH_SIZE = 1000;
    let allMemberships: any[] = [];
    let start = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('list_leads_membership')
            .select('id, schema, status, list_id')
            .eq('clay_table_id', clayTableId)
            .order('id', { ascending: true })
            .range(start, start + BATCH_SIZE - 1);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (data && data.length > 0) {
            allMemberships.push(...data);
            start += BATCH_SIZE;
            hasMore = data.length === BATCH_SIZE;
        } else {
            hasMore = false;
        }
    }

    const memberships = allMemberships;

    if (memberships.length === 0) {
        return NextResponse.json({ error: 'No leads found' }, { status: 404 });
    }

    // Fetch columns for this list
    const { data: columns } = await supabase
        .from('columns')
        .select('*')
        .eq('list_id', memberships[0].list_id)
        .order('column_order', { ascending: true });

    const cols = (columns as Column[]) || [];

    // Generate CSV content
    const csvRows: string[] = [];

    // Add header row
    const headers = ['lead_membership_id', ...cols.map(c => c.column_raw_name)];
    csvRows.push(headers.map(h => `"${h}"`).join(','));

    // Add data rows
    for (const membership of memberships) {
        const row = generateRow(membership.id, membership.schema, cols);
        csvRows.push(row);
    }

    const csvContent = csvRows.join('\n');

    // Get table name for filename
    const { data: table } = await supabase
        .from('clay_tables')
        .select('clay_table_name')
        .eq('id', clayTableId)
        .single();

    const filename = `${table?.clay_table_name || 'leads'}.csv`;

    return new NextResponse(csvContent, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
