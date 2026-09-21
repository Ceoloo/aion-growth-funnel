/**
 * Test stub for the `server-only` package.
 *
 * In the real build, importing `server-only` from a client component is a
 * compile error — that is what keeps tokens out of the browser bundle. Vitest
 * runs the same modules directly in Node, where the guard has nothing to
 * check, so it resolves to this empty module instead.
 */
export {};
