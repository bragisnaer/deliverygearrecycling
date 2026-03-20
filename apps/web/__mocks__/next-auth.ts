// Vitest mock for next-auth — proxy.test.ts only tests getTenantFromHost (pure function)
// Auth wrapper is stubbed so the pure function remains testable without next-auth's runtime.
export default function NextAuth(_config: any) {
  return {
    handlers: {},
    auth: (fn: (req: any) => any) => fn,
    signIn: async () => {},
    signOut: async () => {},
  }
}

export const auth = (fn: (req: any) => any) => fn
export const signIn = async () => {}
export const signOut = async () => {}
export const handlers = {}
