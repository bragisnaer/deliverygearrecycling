// Vitest mock for @/auth — keeps proxy.test.ts isolated from next-auth/DB dependencies
// The auth() wrapper passes through in tests; getTenantFromHost is what's actually tested.
export const auth = (fn: (req: any) => any) => fn
export const signIn = async () => {}
export const signOut = async () => {}
export const handlers = {}
