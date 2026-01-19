'use server'

import { createClient } from '@/utils/supabase/server'

export async function fetchClayTables(listId: number) {
    const supabase = await createClient()

    try {
        const { data, error } = await supabase
            .from('clay_tables')
            .select(`
                id,
                clay_table_name,
                clay_table_id
            `)
            .eq('lead_list_id', listId)
            .order('id', { ascending: true })

        if (error) {
            console.error('Error fetching clay tables:', error)
            return {
                success: false,
                error: error.message || 'Failed to fetch clay tables',
            }
        }

        // For each table, get lead counts by status
        const tablesWithCounts = await Promise.all(
            (data || []).map(async (table) => {
                // Get total count
                const { count: totalLeads } = await supabase
                    .from('list_leads_membership')
                    .select('*', { count: 'exact', head: true })
                    .eq('clay_table_id', table.id)

                // Get split count
                const { count: splitCount } = await supabase
                    .from('list_leads_membership')
                    .select('*', { count: 'exact', head: true })
                    .eq('clay_table_id', table.id)
                    .eq('status', 'split')

                // Get enriched count
                const { count: enrichedCount } = await supabase
                    .from('list_leads_membership')
                    .select('*', { count: 'exact', head: true })
                    .eq('clay_table_id', table.id)
                    .eq('status', 'enriched')

                // Get new count (status is null or 'new')
                const { count: newCount } = await supabase
                    .from('list_leads_membership')
                    .select('*', { count: 'exact', head: true })
                    .eq('clay_table_id', table.id)
                    .or('status.is.null,status.eq.new')

                return {
                    ...table,
                    total_leads: totalLeads || 0,
                    split_count: splitCount || 0,
                    enriched_count: enrichedCount || 0,
                    new_count: newCount || 0,
                }
            })
        )

        return {
            success: true,
            data: tablesWithCounts,
        }
    } catch (error: any) {
        console.error('Unexpected error:', error)
        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
        }
    }
}

export async function fetchTableLeads(
    clayTableId: number,
    page: number = 1,
    limit: number = 20
) {
    const supabase = await createClient()

    try {
        const offset = (page - 1) * limit

        // Get total count
        const { count } = await supabase
            .from('list_leads_membership')
            .select('*', { count: 'exact', head: true })
            .eq('clay_table_id', clayTableId)

        // Get paginated data
        const { data, error } = await supabase
            .from('list_leads_membership')
            .select('id, schema, status, last_enriched_at, last_enriched_source')
            .eq('clay_table_id', clayTableId)
            .order('id', { ascending: true })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('Error fetching table leads:', error)
            return {
                success: false,
                error: error.message || 'Failed to fetch leads',
            }
        }

        return {
            success: true,
            data: {
                leads: data || [],
                total: count || 0,
                page,
                limit,
                totalPages: Math.ceil((count || 0) / limit),
            },
        }
    } catch (error: any) {
        console.error('Unexpected error:', error)
        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
        }
    }
}

export async function fetchLeadProgress(listId: number) {
    const supabase = await createClient()

    try {
        const { count: totalLeads, error: totalLeadsError } = await supabase
            .from('list_leads_membership')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listId)

        // Get split count
        const { count: splitCount, error: splitCountError } = await supabase
            .from('list_leads_membership')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listId)
            .eq('status', 'split')

        // Get enriched count
        const { count: enrichedCount, error: enrichedCountError } = await supabase
            .from('list_leads_membership')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listId)
            .eq('status', 'enriched')

        // Get new count (status is null or 'new')
        const { count: newCount, error: newCountError } = await supabase
            .from('list_leads_membership')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listId)
            .or('status.is.null,status.eq.new')

        if (totalLeadsError || splitCountError || enrichedCountError || newCountError) {
            console.error('Error fetching lead progress:', totalLeadsError || splitCountError || enrichedCountError || newCountError)
            return {
                success: false,
                error: (totalLeadsError || splitCountError || enrichedCountError || newCountError)?.message || 'Failed to fetch progress',
            }
        }

        return {
            success: true,
            data: {
                new_count: newCount || 0,
                split_count: splitCount || 0,
                enriched_count: enrichedCount || 0,
                total_count: totalLeads || 0,
            },
        }
    } catch (error: any) {
        console.error('Unexpected error:', error)
        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
        }
    }
}
