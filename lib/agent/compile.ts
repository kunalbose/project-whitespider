import type { GraphSpec, Catalog } from '@/lib/agent/capability';

/**
 * Turns an analyzed graph spec into React Flow nodes and edges.
 *
 * The output has to be indistinguishable from a graph the user built by hand — same node
 * `data` shape as Workflow's addNode, same edge shape as its onConnect — because the same
 * canvas renders it and the same engine runs it. Anything the compiler invents that the
 * canvas does not is a divergence that shows up as a node that renders but will not run.
 *
 * Pure function: no DB, no network. Validation happens in capability.ts before this.
 */

export type CompiledGraph = {
    nodes: any[];
    edges: any[];
};

/** Matches the canvas's own spacing closely enough to look hand-placed. */
const X_STEP = 320;
const Y_STEP = 160;
const ORIGIN = { x: 120, y: 200 };

export function compile(graph: GraphSpec, catalog: Catalog, rows: any[] = []): CompiledGraph {
    const toolsByName = new Map(catalog.tools.map((t) => [t.name, t]));
    const positions = layout(graph);

    const nodes = graph.nodes.map((spec) => {
        const base = {
            id: spec.id,
            type: spec.type,
            position: positions.get(spec.id) ?? ORIGIN,
        };

        // Runtime fields every node carries; the canvas seeds these on creation and the
        // ExecutionViewer reads them back off the snapshot.
        const runtime = {
            input: undefined,
            output: undefined,
            status: 'idle' as const,
        };

        if (spec.type === 'test') {
            return {
                ...base,
                data: {
                    label: 'Start',
                    // The batch run resolves its own rows; this only seeds the canvas picker
                    // so a compiled graph is still runnable one row at a time by hand.
                    selectedRowId: rows[0]?.id ?? null,
                    rows: rows.slice(0, 10),
                    ...runtime,
                },
            };
        }

        if (spec.type === 'tool') {
            const tool = toolsByName.get(spec.toolName);
            return {
                ...base,
                data: {
                    label: spec.label || tool?.display_name || spec.toolName,
                    toolName: spec.toolName,
                    inputSchema: tool?.input_schema,
                    arguments: spec.arguments ?? {},
                    ...runtime,
                },
            };
        }

        return {
            ...base,
            data: {
                label: spec.label || 'Map to Column',
                mode: spec.mode ?? 'existing',
                column: spec.column,
                value: spec.value,
                skipIfPopulated: Boolean(spec.skipIfPopulated),
                ...runtime,
            },
        };
    });

    const edges = graph.edges.map((edge) => ({
        id: crypto.randomUUID(),
        source: edge.source,
        target: edge.target,
        animated: true,
        sourceHandle: null,
        targetHandle: null,
    }));

    return { nodes, edges };
}

/**
 * Left-to-right by depth from the start node, siblings stacked vertically.
 *
 * `fitView` on the canvas handles framing, so this only has to avoid overlaps and keep
 * the reading order obvious.
 */
function layout(graph: GraphSpec): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    const start = graph.nodes.find((n) => n.type === 'test') ?? graph.nodes[0];
    if (!start) return positions;

    const depths = new Map<string, number>([[start.id, 0]]);
    const queue = [start.id];

    while (queue.length) {
        const id = queue.shift()!;
        const depth = depths.get(id)!;

        for (const edge of graph.edges) {
            if (edge.source !== id || depths.has(edge.target)) continue;
            depths.set(edge.target, depth + 1);
            queue.push(edge.target);
        }
    }

    const perDepth = new Map<number, number>();
    for (const node of graph.nodes) {
        // Unreachable nodes cannot be produced by an analyzed graph, but placing them
        // after the deepest column beats stacking them all on the origin.
        const depth = depths.get(node.id) ?? Math.max(0, ...depths.values()) + 1;
        const row = perDepth.get(depth) ?? 0;
        perDepth.set(depth, row + 1);

        positions.set(node.id, {
            x: ORIGIN.x + depth * X_STEP,
            y: ORIGIN.y + row * Y_STEP,
        });
    }

    return positions;
}
