import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { getTransportProviders } from './actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function TransportProvidersPage() {
  await requireAuth(['reco-admin', 'reco'])
  const providers = await getTransportProviders()

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
            Transport Providers
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Manage transport provider registry.
          </p>
        </div>
        <Button render={<Link href="/transport/providers/new" />}>Add Provider</Button>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[14px] text-muted-foreground">No transport providers found.</p>
          <Button className="mt-4" render={<Link href="/transport/providers/new" />}>
            Add your first provider
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Service Regions</TableHead>
              <TableHead>Platform Access</TableHead>
              <TableHead>Linked Clients</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell>
                  <Link
                    href={`/transport/providers/${provider.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {provider.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={provider.provider_type === 'direct' ? 'secondary' : 'outline'}>
                    {provider.provider_type === 'direct' ? 'Direct' : 'Consolidation'}
                  </Badge>
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {provider.service_regions ?? '—'}
                </TableCell>
                <TableCell className="text-[13px]">
                  {provider.has_platform_access ? 'Yes' : 'No'}
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {provider.linked_client_count}
                </TableCell>
                <TableCell>
                  {provider.active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/transport/providers/${provider.id}`}
                    className="font-mono text-[13px] text-primary hover:underline"
                  >
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
