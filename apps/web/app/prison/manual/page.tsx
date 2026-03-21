import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getPrisonManualPages } from './actions'

export default async function PrisonManualPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/prison/login')
  }
  if (session.user.role !== 'prison') {
    redirect('/prison/login')
  }

  const pages = await getPrisonManualPages()

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-2xl font-bold mb-2">Driftsmanual</h1>
      <p className="text-muted-foreground mb-6">Vejledninger og ressourcer til drift af anlægget</p>

      {pages.length === 0 ? (
        <p className="text-muted-foreground text-lg">Ingen manualsider tilgængelige endnu.</p>
      ) : (
        <ul className="space-y-4">
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                href={`/prison/manual/${page.slug}`}
                className="block border border-border rounded-lg p-6 hover:bg-muted transition-colors"
              >
                <span className="text-lg font-medium">{page.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
