import { ToolContext } from '../types';

/** Returns whatever it was given. Proves the whole path end to end with zero logic. */
export async function execute(args: any, _ctx: ToolContext) {
    return { received: args ?? {} };
}
