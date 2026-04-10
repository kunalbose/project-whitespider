import { StrictEdge } from "@/components/workflow/Workflow";
import { Node } from "@xyflow/react";

export function getExecutionOrder(nodes: Node[], edges: StrictEdge[], startNodeId: string) {
    const order = [];
    let current = startNodeId;

    while (current) {
        const node = nodes.find((n) => n.id === current);
        order.push(node);

        const edge = edges.find((e) => e.source === current);
        current = edge?.target ?? '';
    }

    return order;
}

export async function executeNode(node: Node, input: any) {
    switch (node.type) {
        case 'test':
            return input;

        case 'noop':
            return input;

        case 'set_field':
            return {
                ...input,
                [node.data.key as string]: node.data.value,
            };

        default:
            return input;
    }
}