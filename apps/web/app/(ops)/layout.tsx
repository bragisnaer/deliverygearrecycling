import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { OpsNavBar } from './ops-nav-bar'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(['reco-admin', 'reco', 'transport', 'prison'])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="font-heading text-lg font-semibold">
            reco ops
          </Link>
          <OpsNavBar />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
