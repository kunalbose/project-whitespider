import { ToolModule } from './types';

/**
 * Implementation key -> lazy importer.
 *
 * This map MUST stay static. A fully dynamic `import(\`./tools/${name}\`)` cannot be
 * statically analyzed and breaks under the Next.js bundler, so every tool gets an
 * explicit line here. The key matches the `implementation` column in Supabase.
 *
 * Adding a tool: write the file, add one line here, insert one registry row.
 *
 * When tools move to a standalone host, this file disappears entirely — replaced by
 * the `endpoint` column on rows with runtime='http'.
 */
export const toolRegistry: Record<string, () => Promise<ToolModule>> = {
    echo: () => import('./tools/echo'),
    normalizeEmail: () => import('./tools/normalizeEmail'),
    fakeCompanyLookup: () => import('./tools/fakeCompanyLookup'),
};
