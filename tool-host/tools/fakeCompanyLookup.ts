import { ToolContext, ToolFailure } from '../types';

const INDUSTRIES = [
    'Software',
    'Financial Services',
    'Healthcare',
    'Manufacturing',
    'Retail',
    'Logistics',
];

/** Stable hash so the same domain always returns the same fake company. */
function hash(input: string) {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
        h = (h * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function titleCase(word: string) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Deterministic fake firmographics for a domain, behind a small delay.
 * Proves async latency, optional arguments, and an enrichment-shaped output.
 */
export async function execute(args: any, _ctx: ToolContext) {
    const domain = args?.domain;

    if (typeof domain !== 'string' || domain.trim() === '') {
        throw new ToolFailure('domain is required and must be a non-empty string', 'BAD_INPUT');
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    const seed = hash(clean);

    const label = clean.split('.')[0].replace(/[-_]/g, ' ');
    const companyName = label.split(' ').filter(Boolean).map(titleCase).join(' ') + ' Inc';

    let employeeCount = 10 + (seed % 4990);
    if (typeof args?.max_employees === 'number' && args.max_employees > 0) {
        employeeCount = Math.min(employeeCount, Math.floor(args.max_employees));
    }

    return {
        domain: clean,
        company_name: companyName,
        employee_count: employeeCount,
        industry: INDUSTRIES[seed % INDUSTRIES.length],
    };
}
