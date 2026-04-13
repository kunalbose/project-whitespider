import { TestNodeConfig } from './TestNode';
import { IfNodeConfig } from './If';

export const nodeConfigRegistry: Record<string, React.FC<any>> = {
    test: TestNodeConfig,
    if: IfNodeConfig,
};