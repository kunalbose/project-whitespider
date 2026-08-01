import { StrictEdge } from "@/components/workflow/Workflow";
import { Node } from "@xyflow/react";
import { executeTool } from "@/lib/tools/client";
import { resolveTemplates } from "@/lib/tools/template";
import { proposeLeadWrite } from "@/lib/workflow/writeProposals";

/**
 * Which row of which execution is being processed. Nodes that persist anything need
 * this; pure transforms ignore it.
 *
 * `listLeadId` is per item, not per run: executeFlow rebinds it for each item from the
 * lineage array before calling executeNode. See FlowContext.
 */
export type RunContext = {
    executionId: number | null;
    listLeadId: number | null;
    isTest: boolean;
};

/**
 * The items in flight, plus which row each one came from.
 *
 * `leadIds` is index-aligned with `data` and tracked alongside it rather than on the
 * items themselves, because an item does not survive a tool node — `case 'tool'` returns
 * the tool's result and the caller replaces `data` with it wholesale, so anything stapled
 * to an item is gone after the first tool. A parallel array survives, and keeps the
 * lineage out of `{{ item.x }}` templating.
 *
 * This is the slice of Plan.md's pairedItem problem that batch writes actually need: 1:1
 * nodes preserve the index, and `if` splits both arrays the same way. It is not full
 * lineage — a node that returns a different number of items than it received would break
 * the alignment, which is why loop and fan-out nodes remain deferred.
 */
export type FlowContext = {
    data: any[];
    leadIds?: (number | null)[];
};

export async function executeNode(node: Node, input: any, run?: RunContext) {
    switch (node.type) {
        case 'test':
            return input;

        // Every registry tool runs through this one case. Adding a tool never touches
        // the engine — see tool-host/registry.ts.
        case 'tool': {
            const toolName = node.data.toolName as string;
            const args = resolveTemplates(
                node.data.arguments ?? {},
                { item: input },
                `node '${node.data.label || toolName}'`
            );

            const res = await executeTool(toolName, args);
            if (!res.success) throw new Error(res.error.message);

            return res.result;
        }

        /**
         * Maps a value onto a column of the row being processed. It never writes the
         * value itself — it records a proposal, so a test run can be reviewed and
         * approved before anything touches the list. Passes the item through unchanged
         * so the node can sit mid-chain.
         */
        case 'map_column': {
            if (!run?.executionId || !run?.listLeadId) {
                throw new Error('map_column needs an execution context; it cannot run outside a workflow run');
            }

            const label = (node.data.label as string) || 'Map to Column';
            const column = node.data.column as string;

            if (!column) throw new Error(`No column selected on node '${label}'`);

            const value = resolveTemplates(
                node.data.value ?? null,
                { item: input },
                `node '${label}'`
            );

            const proposal = await proposeLeadWrite({
                execution_id: run.executionId,
                list_lead_id: run.listLeadId,
                node_id: node.id,
                mode: (node.data.mode as string) ?? 'existing',
                column,
                value,
                skip_if_populated: Boolean(node.data.skipIfPopulated),
            });

            // Nothing is committed here. A test run leaves proposals staged for approval;
            // a real run has them applied once by the caller after the flow completes.
            // Either way the proposal row exists, so there is always an audit trail and a
            // previous_value to revert to.
            return { ...input, _mapped: proposal };
        }

        case 'noop':
            return input;

        case 'set_field':
            return {
                ...input,
                [node.data.key as string]: node.data.value,
            };
        case 'if':
            const fieldValue = input[node.data.field as string];

            if (node.data.operator === 'equals') {
                return fieldValue == node.data.value;
            }

            if (node.data.operator === 'not_equals') {
                return fieldValue != node.data.value;
            }

            return false;

        default:
            return input;
    }
}

// Recursive straight line graph execution -> Updating to DAG traversal
export async function executeFlow(node: Node, context: FlowContext, nodes: Node[], edges: StrictEdge[], emit: (event: any) => void, run?: RunContext) {
    try {
        const input = context.data; // array now
        const leadIds = context.leadIds;
        const outputs = [];

        emit({
            nodeId: node.id,
            patch: {
                status: 'running',
                input: context.data
            }
        });

        for (let i = 0; i < input.length; i++) {
            // Rebind the run to this item's row, so a batch stages one proposal per row
            // rather than N proposals against whichever row the run started from.
            const itemRun = run && leadIds
                ? { ...run, listLeadId: leadIds[i] ?? run.listLeadId }
                : run;

            const output = await executeNode(node, input[i], itemRun);
            outputs.push(output);
        }

        emit({
            nodeId: node.id,
            patch: {
                status: 'completed',
                input,
                output: outputs
            }
        });

        const outgoingEdges = edges.filter(e => e.source === node.id);
        if (outgoingEdges.length === 0) return;

        if (node.type === 'if') {
            const trueItems = [];
            const falseItems = [];
            // Split lineage alongside the items, so each branch keeps knowing which row
            // each of its items came from.
            const trueLeadIds: (number | null)[] = [];
            const falseLeadIds: (number | null)[] = [];

            for (let i = 0; i < input.length; i++) {
                const result = outputs[i];

                if (result) {
                    trueItems.push(input[i]);
                    trueLeadIds.push(leadIds?.[i] ?? null);
                } else {
                    falseItems.push(input[i]);
                    falseLeadIds.push(leadIds?.[i] ?? null);
                }
            }

            const trueEdges = outgoingEdges.filter(e => e.sourceHandle === 'true');
            const falseEdges = outgoingEdges.filter(e => e.sourceHandle === 'false');

            // TRUE first
            if (trueItems.length > 0) {
                for (const edge of trueEdges) {
                    const nextNode = nodes.find(n => n.id === edge.target);
                    if (!nextNode) continue;

                    await executeFlow(nextNode, {
                        data: JSON.parse(JSON.stringify(trueItems)),
                        leadIds: leadIds ? [...trueLeadIds] : undefined
                    }, nodes, edges, emit, run);
                }
            }

            // FALSE next
            if (falseItems.length > 0) {
                for (const edge of falseEdges) {
                    const nextNode = nodes.find(n => n.id === edge.target);
                    if (!nextNode) continue;

                    await executeFlow(nextNode, {
                        data: JSON.parse(JSON.stringify(falseItems)),
                        leadIds: leadIds ? [...falseLeadIds] : undefined
                    }, nodes, edges, emit, run);
                }
            }

            return;
        } else {
            context.data = outputs;
        }

        for (const edge of outgoingEdges) {
            const nextNode = nodes.find(n => n.id === edge.target);
            if (!nextNode) continue;

            const branchContext: FlowContext = {
                data: JSON.parse(JSON.stringify(context.data)),
                // 1:1 nodes preserve the index, so the same lineage carries forward.
                leadIds: leadIds ? [...leadIds] : undefined,
            };

            await executeFlow(nextNode, branchContext, nodes, edges, emit, run);
        }
    } catch (error) {
        emit({ nodeId: node.id, patch: { status: 'error' } });
        throw error;
    }
}