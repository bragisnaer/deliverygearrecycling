// Vitest mock for next/server — keeps proxy.test.ts isolated from Next.js runtime
// The proxy.test.ts only tests getTenantFromHost (pure function), not middleware execution.
export class NextResponse {
  static next(opts?: any) { return new NextResponse() }
  static redirect(url: any) { return new NextResponse() }
  static json(body: any, init?: any) { return new NextResponse() }
}

export class NextRequest {
  nextUrl: any
  headers: any
  constructor(url: string, init?: any) {
    this.nextUrl = { clone: () => ({ hostname: '', pathname: '/', searchParams: new URLSearchParams() }) }
    this.headers = new Map()
  }
}
