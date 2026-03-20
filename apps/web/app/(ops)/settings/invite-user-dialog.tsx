'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteUser } from './actions'
import type { UserRole } from '@repo/types'
import { USER_ROLES } from '@repo/types'

const TENANT_REQUIRED_ROLES: UserRole[] = ['client', 'client-global', 'transport', 'prison']

export function InviteUserDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('reco')
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const showTenantField = TENANT_REQUIRED_ROLES.includes(role)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      // Reset state on close
      setEmail('')
      setRole('reco')
      setTenantId('')
      setError(null)
      setSuccess(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await inviteUser({
        email,
        role,
        tenant_id: showTenantField && tenantId ? tenantId : null,
      })
      setSuccess(true)
      router.refresh()
      setTimeout(() => setOpen(false), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button className="font-mono text-[13px] font-medium" />}
      >
        Invite User
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
        </DialogHeader>

        {success ? (
          <p className="py-4 text-center text-[14px] text-muted-foreground">
            Invitation sent to {email}.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="user@company.com"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {showTenantField && (
              <div className="space-y-1">
                <Label htmlFor="invite-tenant">Tenant ID</Label>
                <Input
                  id="invite-tenant"
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="e.g. wolt"
                />
              </div>
            )}

            {error && (
              <p className="text-[13px] text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="font-mono text-[13px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-primary font-mono text-[13px] font-medium text-primary-foreground"
              >
                {loading ? 'Sending…' : 'Send invitation'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
