import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { getTransportProvider, getAllTenants } from '../actions'
import { ProviderForm } from '../components/provider-form'

interface TransportProviderDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TransportProviderDetailPage({
  params,
}: TransportProviderDetailPageProps) {
  const { id } = await params
  const [provider, tenants] = await Promise.all([getTransportProvider(id), getAllTenants()])

  if (!provider) {
    notFound()
  }

  return (
    <div className="max-w-3xl space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/transport/providers" className="hover:text-foreground hover:underline">
          Transport Providers
        </Link>
        <span>/</span>
        <span className="text-foreground">{provider.name}</span>
      </div>

      {/* Page heading */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">{provider.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={provider.provider_type === 'direct' ? 'secondary' : 'outline'}>
              {provider.provider_type === 'direct' ? 'Direct' : 'Consolidation'}
            </Badge>
            {provider.active ? (
              <Badge variant="secondary">Active</Badge>
            ) : (
              <Badge variant="outline">Inactive</Badge>
            )}
            {provider.has_platform_access && (
              <Badge variant="secondary">Platform Access</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Provider details form */}
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold">Provider Details</h2>
        <ProviderForm
          tenants={tenants}
          provider={{
            id: provider.id,
            name: provider.name,
            contact_email: provider.contact_email,
            contact_phone: provider.contact_phone,
            service_regions: provider.service_regions,
            provider_type: provider.provider_type,
            warehouse_address: provider.warehouse_address,
            has_platform_access: provider.has_platform_access,
            active: provider.active,
            linked_tenant_ids: provider.linked_tenant_ids,
          }}
        />
      </section>
    </div>
  )
}
