import Link from 'next/link'
import { getAllTenants } from '../actions'
import { ProviderForm } from '../components/provider-form'

export default async function NewTransportProviderPage() {
  const tenants = await getAllTenants()

  return (
    <div className="max-w-3xl space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/transport/providers" className="hover:text-foreground hover:underline">
          Transport Providers
        </Link>
        <span>/</span>
        <span className="text-foreground">New Provider</span>
      </div>

      {/* Page heading */}
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">New Transport Provider</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Add a new transport provider to the registry.
        </p>
      </div>

      {/* Create form — no provider prop = create mode */}
      <ProviderForm tenants={tenants} />
    </div>
  )
}
