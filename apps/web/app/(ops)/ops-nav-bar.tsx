'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Pickups', href: '/pickups' },
  { label: 'Transport', href: '/transport' },
  { label: 'Intake', href: '/intake' },
  { label: 'Processing', href: '/processing' },
  { label: 'Dispatch', href: '/dispatch' },
  { label: 'Financial', href: '/financial' },
  { label: 'ESG', href: '/esg' },
  { label: 'Manuals', href: '/manual-editor' },
  { label: 'Products', href: '/products' },
  { label: 'Settings', href: '/settings' },
]

const RECO_ADMIN_NAV_ITEMS = [{ label: 'Import', href: '/import' }]

interface OpsNavBarProps {
  role?: string | null
}

export function OpsNavBar({ role }: OpsNavBarProps) {
  const pathname = usePathname()

  const items = [
    ...NAV_ITEMS,
    ...(role === 'reco-admin' ? RECO_ADMIN_NAV_ITEMS : []),
  ]

  return (
    <nav className="flex items-center gap-6">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'font-mono text-[13px] transition-colors',
              isActive
                ? 'font-semibold text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
