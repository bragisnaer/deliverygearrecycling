import Link from 'next/link'

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="font-heading text-2xl font-semibold">Access Denied</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to access this page.
        </p>
        <Link
          href="/sign-in"
          className="inline-block rounded-md border-2 border-foreground bg-background px-4 py-2 font-mono text-sm hover:bg-secondary"
        >
          Sign in with a different account
        </Link>
      </div>
    </div>
  )
}
