import { ToolContext, ToolFailure } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercase + trim an email, pull out its domain, flag whether it looks valid. */
export async function execute(args: any, _ctx: ToolContext) {
    const email = args?.email;

    if (typeof email !== 'string' || email.trim() === '') {
        throw new ToolFailure('email is required and must be a non-empty string', 'BAD_INPUT');
    }

    const normalized = email.trim().toLowerCase();
    const isValid = EMAIL_RE.test(normalized);

    return {
        email,
        normalized,
        domain: isValid ? normalized.split('@')[1] : null,
        is_valid: isValid,
    };
}
