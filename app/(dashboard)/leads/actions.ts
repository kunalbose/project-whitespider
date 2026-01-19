'use server'

import { createClient } from '@/utils/supabase/server'

export async function startLeadImport(listId: number) {
    const supabase = await createClient()

    try {
        // Call Supabase Edge Function from server-side
        const { data, error } = await supabase.functions.invoke('import-leads-from-storage', {
            body: { listId },
        })

        if (error) {
            console.error('Edge Function error:', error)
            return {
                success: false,
                error: error.message || 'Failed to start import',
            }
        }

        // Serialize data to ensure it's compatible with React Server Components
        return {
            success: true,
            data: data ? JSON.parse(JSON.stringify(data)) : null,
        }
    } catch (error: any) {
        console.error('Unexpected error:', error)
        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
        }
    }
}

export async function fetchListDetails(listId: number) {
    const supabase = await createClient()

    try {
        const { data, error } = await supabase
            .from('lead_lists')
            .select('*')
            .eq('id', listId)

        if (error) {
            console.error('Error fetching list details:', error)
            return {
                success: false,
                error: error.message || 'Failed to fetch list details',
            }
        }

        // Get the first item from the array instead of using .single()
        const listData = data && data.length > 0 ? data[0] : null

        if (!listData) {
            return {
                success: false,
                error: 'List not found',
            }
        }

        // Serialize data to ensure JSONB columns are properly handled
        return {
            success: true,
            data: JSON.parse(JSON.stringify(listData)),
        }
    } catch (error: any) {
        console.error('Unexpected error:', error)
        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
        }
    }
}

export async function updateLeadSplit(listId: number, leadSplit: number) {
    const supabase = await createClient()

    try {
        const { data, error } = await supabase
            .from('lead_lists')
            .update({ lead_split: leadSplit })
            .eq('id', listId)
            .select()

        if (error) {
            console.error('Error updating lead_split:', error)
            return {
                success: false,
                error: error.message || 'Failed to update lead_split',
            }
        }

        // Get the first item from the array
        const updatedData = data && data.length > 0 ? data[0] : null

        // Serialize data to ensure JSONB columns are properly handled
        return {
            success: true,
            data: updatedData ? JSON.parse(JSON.stringify(updatedData)) : null,
        }
    } catch (error: any) {
        console.error('Unexpected error:', error)
        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
        }
    }
}

export async function updateListStatus(listId: number, status: string) {
    const supabase = await createClient()

    try {
        const { data, error } = await supabase
            .from('lead_lists')
            .update({ status })
            .eq('id', listId)
            .select()

        if (error) {
            console.error('Error updating status:', error)
            return {
                success: false,
                error: error.message || 'Failed to update status',
            }
        }

        // Get the first item from the array
        const updatedData = data && data.length > 0 ? data[0] : null

        // Serialize data to ensure JSONB columns are properly handled
        return {
            success: true,
            data: updatedData ? JSON.parse(JSON.stringify(updatedData)) : null,
        }
    } catch (error: any) {
        console.error('Unexpected error:', error)
        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
        }
    }
}

export async function startLeadSplitting(listId: number) {
    const supabase = await createClient()

    try {
        // Update status to splitting_leads before calling edge function
        await supabase
            .from('lead_lists')
            .update({ status: 'splitting_leads' })
            .eq('id', listId)

        // Call the edge function which executes the RPC
        const { data, error } = await supabase.functions.invoke('lead_splitting', {
            body: { listId },
        })

        if (error) {
            console.error('Edge function error:', error)

            // Update status to failed
            await supabase
                .from('lead_lists')
                .update({
                    status: 'lead_split_failed',
                    error: error.message || 'Failed to split leads'
                })
                .eq('id', listId)

            return {
                success: false,
                error: error.message || 'Failed to split leads',
            }
        }

        // Serialize data to ensure it's compatible with React Server Components
        return {
            success: true,
            data: data ? JSON.parse(JSON.stringify(data)) : null,
        }
    } catch (error: any) {
        console.error('Unexpected error:', error)

        // Update status to failed
        const supabase2 = await createClient()
        await supabase2
            .from('lead_lists')
            .update({
                status: 'lead_split_failed',
                error: error.message || 'An unexpected error occurred'
            })
            .eq('id', listId)

        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
        }
    }
}

