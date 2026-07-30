import { StrictEdge } from "@/components/workflow/Workflow";
import { Node } from "@xyflow/react";
import { executeTool } from "@/lib/tools/client";
import { resolveTemplates } from "@/lib/tools/template";

export async function executeNode(node: Node, input: any) {
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
export async function executeFlow(node: Node, context: any, nodes: Node[], edges: StrictEdge[], emit: (event: any) => void) {
    try {
        const input = context.data; // array now
        const outputs = [];

        emit({
            nodeId: node.id,
            patch: {
                status: 'running',
                input: context.data
            }
        });

        for (const item of input) {
            const output = await executeNode(node, item);
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

            for (let i = 0; i < input.length; i++) {
                const result = outputs[i];

                if (result) trueItems.push(input[i]);
                else falseItems.push(input[i]);
            }

            const trueEdges = outgoingEdges.filter(e => e.sourceHandle === 'true');
            const falseEdges = outgoingEdges.filter(e => e.sourceHandle === 'false');

            // TRUE first
            if (trueItems.length > 0) {
                for (const edge of trueEdges) {
                    const nextNode = nodes.find(n => n.id === edge.target);
                    if (!nextNode) continue;

                    await executeFlow(nextNode, {
                        data: JSON.parse(JSON.stringify(trueItems))
                    }, nodes, edges, emit);
                }
            }

            // FALSE next
            if (falseItems.length > 0) {
                for (const edge of falseEdges) {
                    const nextNode = nodes.find(n => n.id === edge.target);
                    if (!nextNode) continue;

                    await executeFlow(nextNode, {
                        data: JSON.parse(JSON.stringify(falseItems))
                    }, nodes, edges, emit);
                }
            }

            return;
        } else {
            context.data = outputs;
        }

        for (const edge of outgoingEdges) {
            const nextNode = nodes.find(n => n.id === edge.target);
            if (!nextNode) continue;

            const branchContext = {
                data: JSON.parse(JSON.stringify(context.data)),
            };

            await executeFlow(nextNode, branchContext, nodes, edges, emit);
        }
    } catch (error) {
        emit({ nodeId: node.id, patch: { status: 'error' } });
        throw error;
    }
}