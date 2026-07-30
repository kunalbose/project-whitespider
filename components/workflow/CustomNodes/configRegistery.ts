import { TestNodeConfig } from './TestNode';
import { IfNodeConfig } from './If';
import { ToolNodeConfig } from './ToolNode';

export const nodeConfigRegistry: Record<string, React.FC<any>> = {
    test: TestNodeConfig,
    if: IfNodeConfig,
    // Every registry tool shares this one schema-driven form.
    tool: ToolNodeConfig,
};