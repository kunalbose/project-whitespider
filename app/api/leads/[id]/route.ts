import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashApiKey } from '@/lib/api-keys';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. API Key validation might fail if RLS is strict.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const authHeader = request.headers.get('authorization');

    if (!id) {
        return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];

    // 2. Validate Key
    const hashed = hashApiKey(apiKey);
    const { data: keyRecord, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, status')
        .eq('key_hash', hashed)
        .single();

    if (error || !keyRecord) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
    }

    if (keyRecord.status !== 'active') {
        return NextResponse.json({ error: 'API Key is revoked or inactive' }, { status: 403 });
    }

    // 3. Check Rate Limit
    const limitResult = await checkRateLimit(keyRecord.id.toString());

    const headers = {
        'X-RateLimit-Limit': limitResult.limit.toString(),
        'X-RateLimit-Remaining': limitResult.remaining.toString(),
        'X-RateLimit-Reset': limitResult.reset.toString(),
    };

    if (!limitResult.success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers });
    }

    // Fetching the lead
    const { data: lead, error: leadError } = await supabaseAdmin
        .from('list_leads_membership')
        .select('*')
        .eq('id', id)
        .single();

    if (leadError || !lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ lead }, { headers });
}