import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { getDispatchFormData } from '../actions'
import { DispatchForm } from '../components/dispatch-form'

export default async function NewDispatchPage() {
  await requireAuth(['reco-admin'])

  const { facilities, tenants, products } = await getDispatchFormData()

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/dispatch" className="hover:text-foreground hover:underline">
          Dispatches
        </Link>
        <span>/</span>
        <span className="text-foreground">New</span>
      </div>

      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">Create Dispatch</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Create an outbound dispatch record with a packing list for the redistribution partner.
        </p>
      </div>

      <DispatchForm
        facilities={facilities}
        tenants={tenants}
        products={products}
      />
    </div>
  )
}
