import { supabase } from '@/lib/supabase';

/**
 * Staged writes.
 *
 * A mapper node records what it intends to write rather than writing it. That is what
 * lets a test run across N rows be reviewed as a real before/after diff and then
 * approved — and, because previous_value is captured at propose time, reverted.
 *
 * All four functions are SECURITY DEFINER RPCs (see 0002_write_proposals.sql); the app
 * only holds the anon key, so the write path has to go through them.
 */

export type WriteProposal = {
    proposal_id: number;
    target: 'schema' | 'extra_field' | 'internal_enrichment' | 'external_enrichment';
    column: string;
    previous_value: any;
    new_value: any;
    is_new_column: boolean;
    status: 'proposed' | 'skipped';
};

export type ProposeArgs = {
    execution_id: number;
    list_lead_id: number;
    node_id?: string;
    mode?: string;
    column: string;
    value: any;
    skip_if_populated?: boolean;
};

/** Records an intended write. Touches no live data. Throws on failure. */
export async function proposeLeadWrite(args: ProposeArgs): Promise<WriteProposal> {
    const { data, error } = await supabase.rpc('propose_lead_write', { p_payload: args });

    if (error) throw new Error(`Could not stage the write: ${error.message}`);
    if (!data?.success) throw new Error(data?.error || 'Could not stage the write');

    return data as WriteProposal;
}

/** Commits every proposed write for an execution. */
export async function applyWriteProposals(executionId: number) {
    const { data, error } = await supabase.rpc('apply_write_proposals', {
        p_execution_id: executionId,
    });

    if (error) throw new Error(`Could not apply the writes: ${error.message}`);
    return data as { success: boolean; applied: number; failed: number; errors: any[] };
}

/** Puts previous_value back for everything already applied. */
export async function revertWriteProposals(executionId: number) {
    const { data, error } = await supabase.rpc('revert_write_proposals', {
        p_execution_id: executionId,
    });

    if (error) throw new Error(`Could not revert the writes: ${error.message}`);
    return data as { success: boolean; reverted: number };
}

/** Rejects an execution's staged writes without applying them. */
export async function discardWriteProposals(executionId: number) {
    const { data, error } = await supabase.rpc('discard_write_proposals', {
        p_execution_id: executionId,
    });

    if (error) throw new Error(`Could not discard the writes: ${error.message}`);
    return data as { success: boolean; discarded: number };
}
