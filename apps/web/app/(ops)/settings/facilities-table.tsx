'use client'

import { useState, useRef } from 'react'
import { ArchiveIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createFacility, updateFacility, archiveFacility } from './actions'

// --- Types ---

type Facility = {
  id: string
  slug: string
  name: string
  address: string
  contact_email: string
  active: boolean
  created_at: Date
  updated_at: Date
}

type NewRow = {
  isNew: true
  id: string
  slug: string
  name: string
  address: string
  contact_email: string
  active: boolean
}

type EditState = {
  facilityId: string
  field: keyof Pick<Facility, 'slug' | 'name' | 'address' | 'contact_email'>
  value: string
}

type PendingChange = {
  [field in keyof Pick<Facility, 'slug' | 'name' | 'address' | 'contact_email'>]?: string
}

interface FacilitiesTableProps {
  facilities: Facility[]
}

// --- Column definitions ---
const COLUMNS: {
  key: keyof Pick<Facility, 'slug' | 'name' | 'address' | 'contact_email'>
  label: string
}[] = [
  { key: 'slug', label: 'Slug' },
  { key: 'name', label: 'Facility name' },
  { key: 'address', label: 'Address' },
  { key: 'contact_email', label: 'Contact email' },
]

const NEW_ROW_ID = '__new__'

export function FacilitiesTable({ facilities: initialFacilities }: FacilitiesTableProps) {
  const [facilities, setFacilities] = useState<Facility[]>(initialFacilities)
  const [newRow, setNewRow] = useState<NewRow | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({})
  const [editState, setEditState] = useState<EditState | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Facility | null>(null)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  const hasPendingChanges =
    Object.keys(pendingChanges).length > 0 || newRow !== null

  // --- Cell editing ---

  function startEdit(
    facilityId: string,
    field: EditState['field'],
    currentValue: string
  ) {
    setEditState({ facilityId, field, value: currentValue })
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    if (!editState) return
    const { facilityId, field, value } = editState

    if (facilityId === NEW_ROW_ID) {
      setNewRow((prev) => (prev ? { ...prev, [field]: value } : prev))
      // Auto-focus next field
      const currentIdx = COLUMNS.findIndex((c) => c.key === field)
      const nextCol = COLUMNS[currentIdx + 1]
      if (nextCol && newRow) {
        setEditState({ facilityId: NEW_ROW_ID, field: nextCol.key, value: newRow[nextCol.key] })
        setTimeout(() => inputRef.current?.select(), 0)
      } else {
        setEditState(null)
      }
    } else {
      setPendingChanges((prev) => ({
        ...prev,
        [facilityId]: {
          ...prev[facilityId],
          [field]: value,
        },
      }))
      setEditState(null)
    }
  }

  function cancelEdit() {
    setEditState(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  // --- Add new facility row ---

  function handleAddFacility() {
    const tempId = NEW_ROW_ID
    const row: NewRow = {
      isNew: true,
      id: tempId,
      slug: '',
      name: '',
      address: '',
      contact_email: '',
      active: true,
    }
    setNewRow(row)
    setEditState({ facilityId: tempId, field: 'slug', value: '' })
    setTimeout(() => inputRef.current?.select(), 0)
  }

  // --- Save all pending changes ---

  async function handleSaveAll() {
    setSaving(true)
    try {
      // Save new row if present
      if (newRow) {
        const created = await createFacility({
          slug: newRow.slug,
          name: newRow.name,
          address: newRow.address,
          contact_email: newRow.contact_email,
        })
        if (created) {
          setFacilities((prev) => [...prev, created as unknown as Facility])
        }
        setNewRow(null)
      }

      // Save pending changes for existing rows
      for (const [id, changes] of Object.entries(pendingChanges)) {
        await updateFacility(id, changes)
        setFacilities((prev) =>
          prev.map((f) => (f.id === id ? { ...f, ...changes } : f))
        )
      }
      setPendingChanges({})
      toast.success('Settings saved.', { duration: 3000 })
    } catch {
      toast.error('Failed to save. Please try again.', { duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  // --- Archive ---

  async function handleArchiveConfirm() {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      await archiveFacility(archiveTarget.id)
      setFacilities((prev) =>
        prev.map((f) => (f.id === archiveTarget.id ? { ...f, active: false } : f))
      )
      setArchiveTarget(null)
      toast.success('Settings saved.', { duration: 3000 })
    } catch {
      toast.error('Failed to save. Please try again.', { duration: 5000 })
    } finally {
      setArchiving(false)
    }
  }

  // --- Render cell ---

  function renderCell(
    facilityId: string,
    field: EditState['field'],
    displayValue: string
  ) {
    const isEditing =
      editState?.facilityId === facilityId && editState?.field === field

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type={field === 'contact_email' ? 'email' : 'text'}
          value={editState.value}
          onChange={(e) => setEditState((prev) => prev ? { ...prev, value: e.target.value } : prev)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          autoFocus
          className="w-full min-w-[120px] rounded border border-ring bg-transparent px-2 py-1 text-[14px] outline-none ring-2 ring-ring/50"
          aria-label={field}
        />
      )
    }

    const pendingValue =
      facilityId !== NEW_ROW_ID
        ? pendingChanges[facilityId]?.[field]
        : undefined
    const shown = pendingValue !== undefined ? pendingValue : displayValue

    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => startEdit(facilityId, field, shown)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') startEdit(facilityId, field, shown)
        }}
        className="block min-h-[24px] cursor-text rounded px-1 py-0.5 text-[14px] hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {shown || <span className="text-muted-foreground italic">—</span>}
        {field === 'slug' && facilityId === NEW_ROW_ID && shown && (
          <span className="ml-2 text-[12px] text-muted-foreground not-italic">
            Used in prison login URL: /prison/login?facility={shown}
          </span>
        )}
      </span>
    )
  }

  // --- Render ---

  const allRows = [
    ...facilities,
    ...(newRow ? [{ ...newRow, created_at: new Date(), updated_at: new Date() }] : []),
  ]

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Prison Facilities</CardTitle>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddFacility}
              className="font-mono text-[13px] font-medium"
            >
              <PlusIcon className="size-4" />
              Add facility
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {allRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[16px] font-semibold text-foreground">
                No facilities configured
              </p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Add a prison facility to enable prison staff login and transport bookings.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[14px] font-semibold">Slug</TableHead>
                    <TableHead className="text-[14px] font-semibold">Facility name</TableHead>
                    <TableHead className="text-[14px] font-semibold">Address</TableHead>
                    <TableHead className="text-[14px] font-semibold">Contact email</TableHead>
                    <TableHead className="text-[14px] font-semibold">Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRows.map((facility) => {
                    const isNew = 'isNew' in facility
                    const hasPending = !isNew && !!pendingChanges[facility.id]
                    const isArchived = !facility.active

                    return (
                      <TableRow
                        key={facility.id}
                        className={[
                          'min-h-[48px]',
                          hasPending ? 'border-l-2 border-l-primary' : '',
                          isArchived ? 'opacity-60' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {/* Slug */}
                        <TableCell className="min-h-[48px] align-middle">
                          <div>
                            {renderCell(facility.id, 'slug', facility.slug)}
                            {facility.id !== NEW_ROW_ID &&
                              !(editState?.facilityId === facility.id && editState?.field === 'slug') &&
                              facility.slug && (
                                <span className="block text-[12px] text-muted-foreground">
                                  /prison/login?facility={pendingChanges[facility.id]?.slug ?? facility.slug}
                                </span>
                              )}
                          </div>
                        </TableCell>

                        {/* Name */}
                        <TableCell className="min-h-[48px] align-middle">
                          {renderCell(facility.id, 'name', facility.name)}
                        </TableCell>

                        {/* Address */}
                        <TableCell className="min-h-[48px] align-middle">
                          {renderCell(facility.id, 'address', facility.address)}
                        </TableCell>

                        {/* Contact email */}
                        <TableCell className="min-h-[48px] align-middle">
                          {renderCell(facility.id, 'contact_email', facility.contact_email)}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="min-h-[48px] align-middle">
                          {isNew ? (
                            <Badge variant="outline" className="font-mono text-[13px]">
                              New
                            </Badge>
                          ) : facility.active ? (
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 font-mono text-[13px] text-foreground"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="font-mono text-[13px]">
                              Archived
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="min-h-[48px] align-middle">
                          {!isNew && facility.active && (
                            <button
                              type="button"
                              onClick={() => setArchiveTarget(facility as Facility)}
                              aria-label={`Archive ${facility.name}`}
                              className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                              <ArchiveIcon className="size-4" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Table-level save button */}
          {hasPendingChanges && (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleSaveAll}
                disabled={saving}
                className="font-mono text-[13px] font-medium min-h-[44px]"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archive confirmation dialog */}
      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setArchiveTarget(null)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Archive facility?</DialogTitle>
            <DialogDescription>
              Archiving {archiveTarget?.name} will remove it from the active facility list.
              This action can be reversed by reco-admin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveTarget(null)}
              disabled={archiving}
              className="font-mono text-[13px] font-medium"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchiveConfirm}
              disabled={archiving}
              className="font-mono text-[13px] font-medium bg-destructive text-destructive-foreground"
            >
              {archiving ? 'Archiving…' : 'Archive facility'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
