import { auth } from '@/auth'

export default async function OpsDashboard() {
  const session = await auth()
  return (
    <div>
      <h2 className="text-xl font-semibold">Ops Dashboard</h2>
      <p className="text-muted-foreground">Welcome, {session?.user?.name ?? session?.user?.email}</p>
      <p className="text-sm text-muted-foreground">Role: {session?.user?.role}</p>
    </div>
  )
}
