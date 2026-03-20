'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { InviteUserDialog } from './invite-user-dialog'
import { deactivateUser, reactivateUser } from './actions'

type User = {
  id: string
  email: string
  role: string
  tenant_id: string | null
  active: boolean
  created_at: Date
}

interface UsersTableProps {
  users: User[]
}

export function UsersTable({ users }: UsersTableProps) {
  const router = useRouter()

  async function handleDeactivate(user: User) {
    const confirmed = window.confirm(
      `Deactivate ${user.email}? They will lose access immediately.`
    )
    if (!confirmed) return
    await deactivateUser(user.id)
    router.refresh()
  }

  async function handleReactivate(user: User) {
    await reactivateUser(user.id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-muted-foreground">
          {users.length} user{users.length !== 1 ? 's' : ''}
        </p>
        <InviteUserDialog />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[14px] font-semibold">Email</TableHead>
              <TableHead className="text-[14px] font-semibold">Role</TableHead>
              <TableHead className="text-[14px] font-semibold">Tenant</TableHead>
              <TableHead className="text-[14px] font-semibold">Status</TableHead>
              <TableHead className="text-[14px] font-semibold">Invited</TableHead>
              <TableHead className="text-[14px] font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-[14px] text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="text-[14px]">{user.email}</TableCell>
                  <TableCell className="font-mono text-[13px]">{user.role}</TableCell>
                  <TableCell className="text-[14px] text-muted-foreground">
                    {user.tenant_id ?? '—'}
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-[12px] font-medium text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[12px] font-medium text-red-800">
                        Deactivated
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[14px] text-muted-foreground">
                    {user.created_at.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="font-mono text-[13px]"
                        onClick={() => handleDeactivate(user)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-mono text-[13px]"
                        onClick={() => handleReactivate(user)}
                      >
                        Reactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
