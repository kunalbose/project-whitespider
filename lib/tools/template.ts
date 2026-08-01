/**
 * {{ }} templating for tool arguments.
 *
 * Deliberate ceiling: an expression is a dot/bracket PATH and nothing else —
 * `item.email`, `item.extra_fields["company"]`. No eval, no expression grammar, no
 * arbitrary JS. That covers essentially every real mapping and has no injection surface.
 *
 * Pure function: no DB, no network.
 */

export class TemplateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TemplateError';
    }
}

export type TemplateScope = {
    item?: any;
    $now?: string;
    [key: string]: any;
};

const TEMPLATE_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
const WHOLE_TEMPLATE_RE = /^\{\{\s*([^}]+?)\s*\}\}$/;

/**
 * Walks arbitrary JSON and resolves every {{ path }} it finds.
 *
 * Type preservation matters: a string that is exactly one template returns the
 * referenced value with its original type, so numeric tool inputs stay numbers.
 * A mixed string interpolates.
 */
export function resolveTemplates<T = any>(
    value: T,
    scope: TemplateScope,
    context?: string
): T {
    const fullScope: TemplateScope = { $now: new Date().toISOString(), ...scope };
    return walk(value, fullScope, context) as T;
}

function walk(value: any, scope: TemplateScope, context?: string): any {
    if (typeof value === 'string') return resolveString(value, scope, context);
    if (Array.isArray(value)) return value.map((v) => walk(v, scope, context));

    if (value && typeof value === 'object' && value.constructor === Object) {
        const out: Record<string, any> = {};
        for (const [key, v] of Object.entries(value)) {
            out[key] = walk(v, scope, context);
        }
        return out;
    }

    // numbers, booleans, null, undefined, Dates, everything else: untouched
    return value;
}

function resolveString(input: string, scope: TemplateScope, context?: string) {
    const whole = input.match(WHOLE_TEMPLATE_RE);

    // Exactly one template and nothing else -> return the value with its real type.
    if (whole) {
        return readPath(whole[1].trim(), scope, context);
    }

    if (!input.includes('{{')) return input;

    return input.replace(TEMPLATE_RE, (_match, expr: string) => {
        const resolved = readPath(expr.trim(), scope, context);
        if (resolved === null) return '';
        return typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
    });
}

/** Splits `item.extra_fields["company"].name` into ['item','extra_fields','company','name']. */
function parsePath(expr: string, context?: string): string[] {
    const segments: string[] = [];
    const re = /([A-Za-z_$][\w$]*)|\[\s*"([^"]*)"\s*\]|\[\s*'([^']*)'\s*\]|\[\s*(\d+)\s*\]/g;

    let consumed = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(expr)) !== null) {
        // Reject anything between segments that isn't a dot — no operators, no calls.
        const gap = expr.slice(consumed, match.index).trim();
        if (gap !== '' && gap !== '.') {
            throw new TemplateError(unsupported(expr, context));
        }
        segments.push(match[1] ?? match[2] ?? match[3] ?? match[4]);
        consumed = match.index + match[0].length;
    }

    if (segments.length === 0 || expr.slice(consumed).trim() !== '') {
        throw new TemplateError(unsupported(expr, context));
    }

    return segments;
}

function readPath(expr: string, scope: TemplateScope, context?: string) {
    const segments = parsePath(expr, context);

    let current: any = scope;
    for (const segment of segments) {
        if (current === null || current === undefined) {
            throw new TemplateError(missing(expr, context));
        }
        current = current[segment];
    }

    if (current === undefined) {
        throw new TemplateError(missing(expr, context));
    }

    return current;
}

/**
 * Every template path in a value, parsed into segments — without resolving anything.
 *
 * The capability analyzer checks a proposed workflow's templates against real columns
 * before a single tool runs. It goes through this rather than its own regex so the two
 * can never drift apart on what counts as a valid path: an expression this accepts is
 * exactly an expression resolveTemplates() accepts.
 *
 * Throws TemplateError on an unsupported expression, same as resolution would.
 */
export function collectTemplatePaths(
    value: any,
    context?: string
): { expr: string; segments: string[] }[] {
    const found: { expr: string; segments: string[] }[] = [];

    const visit = (v: any) => {
        if (typeof v === 'string') {
            for (const match of v.matchAll(TEMPLATE_RE)) {
                const expr = match[1].trim();
                found.push({ expr, segments: parsePath(expr, context) });
            }
            return;
        }

        if (Array.isArray(v)) {
            v.forEach(visit);
            return;
        }

        if (v && typeof v === 'object' && v.constructor === Object) {
            Object.values(v).forEach(visit);
        }
    };

    visit(value);
    return found;
}

function missing(expr: string, context?: string) {
    return `Template path '${expr}' did not resolve${context ? ` in ${context}` : ''}. Check that the field exists on the incoming item.`;
}

function unsupported(expr: string, context?: string) {
    return `Unsupported template expression '${expr}'${context ? ` in ${context}` : ''}. Only field paths are allowed, e.g. {{ item.email }} or {{ item.extra_fields["company"] }}.`;
}
