import { auth } from '@/auth'

export default async function ClientDashboard() {
  const session = await auth()
  return (
    <div>
      <h2 className="text-xl font-semibold">Client Dashboard</h2>
      <p className="text-muted-foreground">Tenant: {session?.user?.tenant_id}</p>
    </div>
  )
}
