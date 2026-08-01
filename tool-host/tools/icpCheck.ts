import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { ToolContext, ToolFailure } from '../types';

/**
 * Is this company in our ICP?
 *
 * Scrapes the company's site through ScrapingDog, reads what it actually sells and to whom,
 * and judges that against an ICP the user describes in plain language on the node.
 *
 * ## The credit budget is the design constraint
 *
 * Every ScrapingDog request costs credits, and the account this was built against has 200 of
 * them. So:
 *
 * - `dynamic=false` on every request. That is the 1-credit tier; `dynamic=true` is 5 and
 *   premium proxies are 10-25. Neither is ever set, and neither should be added without a
 *   deliberate decision about the budget.
 * - `MAX_PAGES_CEILING` is enforced here, not in the schema, so no node configuration and no
 *   agent-generated graph can spend more than 6 credits on one company.
 * - **Nothing is ever retried.** A retry on a flaky fetch silently doubles the spend on a bad
 *   day. A page that fails is dropped and named in `reasoning` instead.
 * - `credits_used` comes back in the result, so the node's OUTPUT panel is the record of what
 *   the budget went on.
 *
 * ## Failure is a verdict, not an exception
 *
 * A site that will not load, or loads with nothing to read, returns `icp_match: 2` — "not
 * sure" is exactly what the caller asked 2 to mean, and a dead site is genuinely a
 * don't-know. Throwing is reserved for things that are *wrong* rather than unknown: bad
 * arguments, a missing API key, or ScrapingDog rejecting us for auth or quota. An exhausted
 * budget has to fail loudly, not quietly log 50 rows of "unsure".
 */

const SCRAPE_ENDPOINT = 'https://api.scrapingdog.com/scrape';
const MODEL = 'claude-haiku-4-5';

/** Total pages per call, homepage included. Ceiling is a hard stop on the credit spend. */
const MAX_PAGES_DEFAULT = 4;
const MAX_PAGES_CEILING = 6;

/** How many links the picker gets to choose from, and how much of each page the model reads. */
const MAX_LINK_CANDIDATES = 40;
const MAX_CHARS_PER_PAGE = 12_000;

/** Below this much text across every page, there is nothing to judge and the answer is 2. */
const MIN_TEXT_FOR_A_VERDICT = 200;

/** Paths that never say what a company sells. Skipped before the model ever sees them. */
const NOISE = [
    'blog', 'news', 'press', 'career', 'job', 'privacy', 'terms', 'legal', 'cookie',
    'login', 'signin', 'sign-in', 'signup', 'sign-up', 'support', 'help', 'docs',
    'documentation', 'status', 'sitemap', 'search', 'account', 'cart', 'checkout',
];

/** Paths that usually do. Used only to rank candidates, never to decide. */
const SIGNAL = [
    'about', 'product', 'solution', 'service', 'platform', 'industr', 'customer',
    'use-case', 'usecase', 'what-we-do', 'company', 'technology', 'overview',
    'capabilit', 'who-we-serve', 'client', 'case-stud', 'pricing', 'markets',
];

const ASSET_EXTENSIONS =
    /\.(pdf|jpe?g|png|gif|svg|webp|ico|css|js|zip|gz|mp4|mp3|woff2?|ttf|eot|xml|rss|json|csv|docx?|xlsx?)$/i;

const SELECTION_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['urls'],
    properties: {
        urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'The chosen URLs, copied verbatim from the candidate list.',
        },
    },
} as const;

const VERDICT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['icp_match', 'company_icp', 'company_summary', 'reasoning'],
    properties: {
        icp_match: {
            type: 'integer',
            enum: [0, 1, 2],
            description:
                '0 if the company is clearly not in the described ICP, 1 if you are confident it is, 2 if the scraped text does not settle it.',
        },
        company_icp: {
            type: 'string',
            description:
                "Who this company sells to, in one sentence, drawn only from the scraped text. Empty string if the text does not say.",
        },
        company_summary: {
            type: 'string',
            description: 'What the company does, in one or two sentences.',
        },
        reasoning: {
            type: 'string',
            description: 'Why that verdict, citing what in the text drove it.',
        },
    },
} as const;

const LABELS = ['not_in_icp', 'in_icp', 'unsure'] as const;

export async function execute(args: any, ctx: ToolContext) {
    const website = normalizeUrl(args?.website);
    const icp = typeof args?.icp_description === 'string' ? args.icp_description.trim() : '';

    if (!website) {
        throw new ToolFailure(
            'website is required and must be a domain or URL, e.g. acme.com',
            'BAD_INPUT'
        );
    }

    if (!icp) {
        throw new ToolFailure(
            'icp_description is required — describe the ICP the company should be judged against',
            'BAD_INPUT'
        );
    }

    const apiKey = process.env.SCRAPING_DOG_API_KEY;
    if (!apiKey) {
        throw new ToolFailure('SCRAPING_DOG_API_KEY is not set', 'CONFIG_ERROR');
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        throw new ToolFailure('ANTHROPIC_API_KEY is not set', 'CONFIG_ERROR');
    }

    const maxPages = clampPages(args?.max_pages);
    const notes: string[] = [];
    let creditsUsed = 0;

    // 1. The homepage. Everything else is optional; this is not.
    const home = await scrape(website, apiKey, ctx.signal);
    creditsUsed += home.creditsUsed;

    if (!home.html) {
        return unsure(
            `Could not read ${website}: ${home.error}`,
            [],
            creditsUsed
        );
    }

    const pages = [{ url: website, text: htmlToText(home.html) }];

    // 2 + 3. Every link on the page, narrowed to the few worth a credit.
    const budget = maxPages - 1;
    if (budget > 0) {
        const candidates = extractLinks(home.html, website);

        if (candidates.length === 0) {
            notes.push('The homepage had no followable internal links.');
        } else {
            const chosen = await pickLinks(candidates, budget, ctx.signal);

            // 4. One attempt each. A failure here costs a credit and buys nothing, but
            //    retrying it would cost another.
            const fetched = await Promise.all(
                chosen.map((url) => scrape(url, apiKey, ctx.signal).then((res) => ({ url, res })))
            );

            for (const { url, res } of fetched) {
                creditsUsed += res.creditsUsed;

                if (res.html) {
                    pages.push({ url, text: htmlToText(res.html) });
                } else {
                    notes.push(`Could not read ${url}: ${res.error}`);
                }
            }
        }
    }

    const totalText = pages.reduce((sum, page) => sum + page.text.length, 0);
    if (totalText < MIN_TEXT_FOR_A_VERDICT) {
        return unsure(
            `Only ${totalText} characters of text could be read from ${website}, which is not enough to judge. ${notes.join(' ')}`.trim(),
            pages.map((p) => p.url),
            creditsUsed
        );
    }

    // 5. The judgement.
    const verdict = await classify(pages, icp, ctx.signal);

    return {
        icp_match: verdict.icp_match,
        icp_match_label: LABELS[verdict.icp_match] ?? 'unsure',
        company_icp: verdict.company_icp,
        company_summary: verdict.company_summary,
        reasoning: notes.length > 0 ? `${verdict.reasoning} (${notes.join(' ')})` : verdict.reasoning,
        pages_scraped: pages.map((p) => p.url),
        credits_used: creditsUsed,
    };
}

/* -------------------------------------------------------------------------- */
/* Scraping                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One page, one credit, one attempt.
 *
 * Resolves with `html: null` for anything the caller can carry on without — a 404, a 500, a
 * site that never answers. Throws only when ScrapingDog itself is refusing us, because that
 * affects every subsequent row and must not be swallowed as an inconclusive result.
 */
async function scrape(url: string, apiKey: string, signal?: AbortSignal) {
    const endpoint = `${SCRAPE_ENDPOINT}?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(url)}&dynamic=false`;

    let res: Response;
    try {
        res = await fetch(endpoint, { signal });
    } catch (err: any) {
        // Never reached the API, so nothing was charged.
        return { html: null, error: err?.message || 'request failed', creditsUsed: 0 };
    }

    if (res.status === 401 || res.status === 403) {
        throw new ToolFailure(
            `ScrapingDog rejected the API key (HTTP ${res.status})`,
            'UPSTREAM_AUTH'
        );
    }

    if (res.status === 402 || res.status === 429) {
        throw new ToolFailure(
            `ScrapingDog is out of credits or rate limiting (HTTP ${res.status})`,
            'UPSTREAM_QUOTA'
        );
    }

    if (!res.ok) {
        return { html: null, error: `HTTP ${res.status}`, creditsUsed: 1 };
    }

    const html = await res.text();
    return { html: html?.trim() ? html : null, error: 'empty response', creditsUsed: 1 };
}

/* -------------------------------------------------------------------------- */
/* HTML                                                                        */
/* -------------------------------------------------------------------------- */

/** Every internal link on the page, ranked so the likely-useful ones survive the cut. */
function extractLinks(html: string, baseUrl: string) {
    const base = new URL(baseUrl);
    const seen = new Set<string>([base.href, `${base.href}/`]);
    const found: string[] = [];

    for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
        const href = match[1].trim();
        if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;

        let url: URL;
        try {
            url = new URL(href, base);
        } catch {
            continue;
        }

        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
        if (bareHost(url.hostname) !== bareHost(base.hostname)) continue;
        if (ASSET_EXTENSIONS.test(url.pathname)) continue;

        // Query strings are usually tracking or filters, and a fragment is the same page.
        url.hash = '';
        url.search = '';

        const clean = url.href.replace(/\/$/, '');
        const path = url.pathname.toLowerCase();

        if (path === '/' || path === '') continue;
        if (NOISE.some((word) => path.includes(word))) continue;
        if (seen.has(clean)) continue;

        seen.add(clean);
        found.push(clean);
    }

    // Rank rather than filter: a site that names its about page something unusual still gets
    // to be considered, it just goes to the back of the queue.
    return found
        .sort((a, b) => score(b) - score(a))
        .slice(0, MAX_LINK_CANDIDATES);
}

function score(url: string) {
    const path = new URL(url).pathname.toLowerCase();
    let total = SIGNAL.reduce((sum, word) => (path.includes(word) ? sum + 10 : sum), 0);
    // Shallower pages tend to be the overview ones.
    total -= (path.match(/\//g)?.length ?? 1) - 1;
    return total;
}

/** Tags out, entities decoded, whitespace collapsed. Enough for a model to read. */
function htmlToText(html: string) {
    return html
        .replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<\/?(p|div|br|li|h[1-6]|tr|section)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n\s*/g, '\n')
        .trim()
        .slice(0, MAX_CHARS_PER_PAGE);
}

/* -------------------------------------------------------------------------- */
/* The model                                                                   */
/* -------------------------------------------------------------------------- */

function anthropic() {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Which of the candidate links are worth a credit.
 *
 * Costs no ScrapingDog credits, which is the whole point of asking: guessing wrong here
 * wastes real budget, and path names are inconsistent enough across sites that a keyword
 * rule alone gets it wrong often. If the call fails, the ranking from `extractLinks` is a
 * perfectly serviceable fallback.
 */
async function pickLinks(candidates: string[], budget: number, signal?: AbortSignal) {
    if (candidates.length <= budget) return candidates;

    try {
        const response = await anthropic().messages.parse(
            {
                model: MODEL,
                max_tokens: 1000,
                system:
                    'You choose which pages of a company website to read in order to work out what the company sells and who it sells to. Prefer overview pages — about, products, solutions, industries, customers — over deep or incidental ones. Return only URLs copied verbatim from the list you were given.',
                messages: [
                    {
                        role: 'user',
                        content: `Choose at most ${budget} of these URLs:\n\n${candidates.join('\n')}`,
                    },
                ],
                output_config: { format: jsonSchemaOutputFormat(SELECTION_SCHEMA) },
            },
            { signal }
        );

        const allowed = new Set(candidates);
        const chosen = (response.parsed_output?.urls ?? []).filter((url) => allowed.has(url));

        // A model that returned nothing usable should not cost us the whole step.
        return chosen.length > 0 ? chosen.slice(0, budget) : candidates.slice(0, budget);
    } catch {
        return candidates.slice(0, budget);
    }
}

async function classify(
    pages: { url: string; text: string }[],
    icp: string,
    signal?: AbortSignal
) {
    const body = pages.map((p) => `--- ${p.url} ---\n${p.text}`).join('\n\n');

    const response = await anthropic().messages.parse(
        {
            model: MODEL,
            max_tokens: 2000,
            system: `You judge whether a company falls inside a described ideal customer profile, using only text scraped from that company's own website.

Answer with:
- 1 — the text makes you confident the company is in the ICP.
- 0 — the text makes you confident it is not.
- 2 — the text does not settle it, either way.

Use 2 honestly. A vague or marketing-heavy site that never says what the company actually does is a 2, not a guess. Do not use what you already know about the company from elsewhere; judge the text in front of you. Never infer a fit from the company merely being adjacent to the ICP.`,
            messages: [
                {
                    role: 'user',
                    content: `## The ICP to judge against\n\n${icp}\n\n## Text scraped from the company's website\n\n${body}`,
                },
            ],
            output_config: { format: jsonSchemaOutputFormat(VERDICT_SCHEMA) },
        },
        { signal }
    );

    const parsed = response.parsed_output;

    if (!parsed) {
        throw new ToolFailure(
            'The classifier did not return a usable verdict',
            'CLASSIFIER_ERROR'
        );
    }

    return parsed;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** `acme.com`, `www.acme.com/`, and `https://acme.com` all mean the same thing here. */
function normalizeUrl(value: unknown) {
    if (typeof value !== 'string' || value.trim() === '') return null;

    const raw = value.trim();
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
        const url = new URL(withScheme);
        if (!url.hostname.includes('.')) return null;
        return `${url.protocol}//${url.hostname}`;
    } catch {
        return null;
    }
}

function bareHost(hostname: string) {
    return hostname.toLowerCase().replace(/^www\./, '');
}

function clampPages(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return MAX_PAGES_DEFAULT;
    return Math.min(Math.floor(n), MAX_PAGES_CEILING);
}

/** A don't-know result, in the same shape as a real verdict. */
function unsure(reason: string, pagesScraped: string[], creditsUsed: number) {
    return {
        icp_match: 2,
        icp_match_label: 'unsure',
        company_icp: '',
        company_summary: '',
        reasoning: reason,
        pages_scraped: pagesScraped,
        credits_used: creditsUsed,
    };
}
