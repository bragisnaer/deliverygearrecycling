import { auth } from '@/auth'
import UninvoicedAlert from '../financial/components/uninvoiced-alert'

export default async function OpsDashboard() {
  const session = await auth()
  const role = session?.user?.role
  const canViewFinancials = session?.user?.can_view_financials

  const hasFinancialAccess =
    role === 'reco-admin' || (role === 'reco' && canViewFinancials === true)

  return (
    <div className="max-w-7xl space-y-6">
      {hasFinancialAccess && <UninvoicedAlert />}
      <div>
        <h2 className="text-xl font-semibold">Ops Dashboard</h2>
        <p className="text-muted-foreground">Welcome, {session?.user?.name ?? session?.user?.email}</p>
        <p className="text-sm text-muted-foreground">Role: {session?.user?.role}</p>
      </div>
    </div>
  )
}
