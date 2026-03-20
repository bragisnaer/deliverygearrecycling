import { requireAuth } from '@/lib/auth-guard'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(['client', 'client-global'])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <h1 className="font-heading text-lg font-semibold">Client Portal</h1>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
