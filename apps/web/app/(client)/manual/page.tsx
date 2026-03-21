import Link from 'next/link'
import { getClientManualPages } from './actions'

export default async function ClientManualPage() {
  const pages = await getClientManualPages()

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-2xl font-bold mb-2">Manual</h1>
      <p className="text-muted-foreground mb-6">Guides and resources for using the platform</p>

      {pages.length === 0 ? (
        <p className="text-muted-foreground">No manual content available yet.</p>
      ) : (
        <ul className="space-y-3">
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                href={`/manual/${page.slug}`}
                className="block border border-border rounded-lg p-4 hover:bg-muted transition-colors"
              >
                <span className="font-medium">{page.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
