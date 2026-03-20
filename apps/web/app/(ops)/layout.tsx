import { requireAuth } from '@/lib/auth-guard'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(['reco-admin', 'reco', 'transport', 'prison'])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <h1 className="font-heading text-lg font-semibold">reco ops</h1>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
