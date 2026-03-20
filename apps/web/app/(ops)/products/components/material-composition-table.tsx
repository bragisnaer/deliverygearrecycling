'use client'

import * as React from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Combobox } from '@base-ui/react/combobox'
import { PlusIcon, XIcon, CheckIcon, ChevronDownIcon, ImageIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  saveMaterialComposition,
  createMaterial,
  uploadMaterialPhoto,
  deleteMaterialPhoto,
} from '../actions'

type RecyclingOutcome = 'recycled' | 'reprocessed' | 'incinerated' | 'landfill' | ''

interface CompositionRow {
  id?: string
  material_library_id: string
  material_name: string
  weight_grams: string
  recycling_cost_per_kg_eur: string
  recycling_cost_per_kg_dkk: string
  recycling_outcome: RecyclingOutcome
  disassembly_photo_urls: string[]
}

interface FormValues {
  rows: CompositionRow[]
}

interface MaterialCompositionTableProps {
  productId: string
  initialComposition: Array<{
    id: string
    material_library_id: string
    material_name: string
    weight_grams: string | null
    recycling_cost_per_kg_eur: string | null
    recycling_cost_per_kg_dkk: string | null
    recycling_outcome: string | null
    disassembly_photo_urls: string[]
  }>
  materials: Array<{ id: string; name: string }>
}

export function MaterialCompositionTable({
  productId,
  initialComposition,
  materials: initialMaterials,
}: MaterialCompositionTableProps) {
  const [saving, setSaving] = React.useState(false)
  const [materialsList, setMaterialsList] = React.useState(initialMaterials)
  const [newMaterialName, setNewMaterialName] = React.useState('')
  const [addingMaterial, setAddingMaterial] = React.useState(false)
  const [pendingRowIndex, setPendingRowIndex] = React.useState<number | null>(null)
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null)
  const [uploadingPhotoFor, setUploadingPhotoFor] = React.useState<string | null>(null)

  const { control, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      rows: initialComposition.map((row) => ({
        id: row.id,
        material_library_id: row.material_library_id,
        material_name: row.material_name,
        weight_grams: row.weight_grams ?? '',
        recycling_cost_per_kg_eur: row.recycling_cost_per_kg_eur ?? '',
        recycling_cost_per_kg_dkk: row.recycling_cost_per_kg_dkk ?? '',
        recycling_outcome: (row.recycling_outcome ?? '') as RecyclingOutcome,
        disassembly_photo_urls: row.disassembly_photo_urls,
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' })
  const rows = watch('rows')

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const lines = values.rows.map((row) => ({
        material_library_id: row.material_library_id,
        weight_grams: row.weight_grams,
        recycling_cost_per_kg_eur: row.recycling_cost_per_kg_eur || null,
        recycling_cost_per_kg_dkk: row.recycling_cost_per_kg_dkk || null,
        recycling_outcome: row.recycling_outcome || null,
      }))
      const result = await saveMaterialComposition(productId, lines)
      if ('error' in result) {
        toast.error(String(result.error))
      } else {
        toast.success('Material composition saved')
      }
    } catch {
      toast.error('Failed to save composition')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateMaterial(rowIndex: number) {
    if (!newMaterialName.trim()) return
    setAddingMaterial(true)
    try {
      const result = await createMaterial(newMaterialName.trim())
      if ('error' in result) {
        toast.error(String(result.error))
        return
      }
      const newMat = { id: result.materialId, name: newMaterialName.trim() }
      setMaterialsList((prev) => [...prev, newMat].sort((a, b) => a.name.localeCompare(b.name)))
      setValue(`rows.${rowIndex}.material_library_id`, newMat.id)
      setValue(`rows.${rowIndex}.material_name`, newMat.name)
      setNewMaterialName('')
      setPendingRowIndex(null)
    } catch {
      toast.error('Failed to create material')
    } finally {
      setAddingMaterial(false)
    }
  }

  async function handlePhotoUpload(lineId: string, rowIndex: number, file: File) {
    setUploadingPhotoFor(lineId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadMaterialPhoto(productId, lineId, fd)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Photo uploaded')
      }
    } catch {
      toast.error('Failed to upload photo')
    } finally {
      setUploadingPhotoFor(null)
    }
  }

  async function handlePhotoDelete(lineId: string, photoPath: string, photoUrl: string, rowIndex: number) {
    if (!confirm('Delete this photo?')) return
    try {
      const result = await deleteMaterialPhoto(productId, lineId, photoPath)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Photo deleted')
        // Remove from local state
        const current = rows[rowIndex]?.disassembly_photo_urls ?? []
        setValue(
          `rows.${rowIndex}.disassembly_photo_urls`,
          current.filter((u) => u !== photoUrl)
        )
      }
    } catch {
      toast.error('Failed to delete photo')
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Material</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Weight (g)</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cost EUR/kg</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cost DKK/kg</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Outcome</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Photos</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {fields.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                    No materials added. Click &quot;Add Material&quot; to begin.
                  </td>
                </tr>
              )}
              {fields.map((field, index) => {
                const row = rows[index]
                const lineId = row?.id
                const photoUrls = row?.disassembly_photo_urls ?? []
                const canAddPhoto = lineId && photoUrls.length < 2

                return (
                  <tr key={field.id} className="border-b border-border last:border-0">
                    {/* Material combobox */}
                    <td className="px-3 py-2 min-w-[180px]">
                      <MaterialCombobox
                        materials={materialsList}
                        value={row?.material_library_id ?? ''}
                        displayValue={row?.material_name ?? ''}
                        onChange={(id, name) => {
                          setValue(`rows.${index}.material_library_id`, id)
                          setValue(`rows.${index}.material_name`, name)
                        }}
                        onAddNew={() => setPendingRowIndex(index)}
                      />
                    </td>

                    {/* Weight */}
                    <td className="px-3 py-2 w-[100px]">
                      <input
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        {...control.register(`rows.${index}.weight_grams`)}
                      />
                    </td>

                    {/* Cost EUR/kg */}
                    <td className="px-3 py-2 w-[110px]">
                      <input
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.0000"
                        {...control.register(`rows.${index}.recycling_cost_per_kg_eur`)}
                      />
                    </td>

                    {/* Cost DKK/kg */}
                    <td className="px-3 py-2 w-[110px]">
                      <input
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.0000"
                        {...control.register(`rows.${index}.recycling_cost_per_kg_dkk`)}
                      />
                    </td>

                    {/* Outcome select */}
                    <td className="px-3 py-2 w-[140px]">
                      <select
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                        {...control.register(`rows.${index}.recycling_outcome`)}
                      >
                        <option value="">— none —</option>
                        <option value="recycled">Recycled</option>
                        <option value="reprocessed">Reprocessed</option>
                        <option value="incinerated">Incinerated</option>
                        <option value="landfill">Landfill</option>
                      </select>
                    </td>

                    {/* Photos */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {photoUrls.map((url, photoIdx) => (
                          <div key={photoIdx} className="group relative">
                            <button
                              type="button"
                              onClick={() => setLightboxUrl(url)}
                              className="block h-10 w-10 overflow-hidden rounded border border-border"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Disassembly photo ${photoIdx + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </button>
                            {lineId && (
                              <button
                                type="button"
                                onClick={() => handlePhotoDelete(lineId, url, url, index)}
                                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-white group-hover:flex"
                                title="Delete photo"
                              >
                                <XIcon className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {canAddPhoto && (
                          <label
                            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:border-ring hover:text-foreground"
                            title="Upload disassembly photo"
                          >
                            {uploadingPhotoFor === lineId ? (
                              <span className="text-[10px]">...</span>
                            ) : (
                              <ImageIcon className="h-4 w-4" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file && lineId) handlePhotoUpload(lineId, index, file)
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </td>

                    {/* Remove row */}
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Remove row"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                id: undefined,
                material_library_id: '',
                material_name: '',
                weight_grams: '',
                recycling_cost_per_kg_eur: '',
                recycling_cost_per_kg_dkk: '',
                recycling_outcome: '',
                disassembly_photo_urls: [],
              })
            }
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Material
          </Button>

          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save Composition'}
          </Button>
        </div>
      </form>

      {/* Add new material dialog */}
      <Dialog open={pendingRowIndex !== null} onOpenChange={(open) => { if (!open) setPendingRowIndex(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Material</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Material name"
              value={newMaterialName}
              onChange={(e) => setNewMaterialName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pendingRowIndex !== null) {
                  e.preventDefault()
                  handleCreateMaterial(pendingRowIndex)
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setPendingRowIndex(null); setNewMaterialName('') }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => pendingRowIndex !== null && handleCreateMaterial(pendingRowIndex)}
              disabled={addingMaterial || !newMaterialName.trim()}
            >
              {addingMaterial ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox dialog */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => { if (!open) setLightboxUrl(null) }}>
        <DialogContent className="max-w-2xl">
          {lightboxUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightboxUrl} alt="Disassembly photo" className="w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Internal Material Combobox ---

interface MaterialComboboxProps {
  materials: Array<{ id: string; name: string }>
  value: string
  displayValue: string
  onChange: (id: string, name: string) => void
  onAddNew: () => void
}

function MaterialCombobox({ materials, value, displayValue, onChange, onAddNew }: MaterialComboboxProps) {
  const [inputValue, setInputValue] = React.useState(displayValue)
  const [open, setOpen] = React.useState(false)

  const filtered = inputValue
    ? materials.filter((m) => m.name.toLowerCase().includes(inputValue.toLowerCase()))
    : materials

  // Sync displayValue when it changes externally
  React.useEffect(() => {
    setInputValue(displayValue)
  }, [displayValue])

  return (
    <Combobox.Root<{ id: string; name: string }>
      value={value ? materials.find((m) => m.id === value) ?? null : null}
      onValueChange={(mat) => {
        if (mat) {
          onChange(mat.id, mat.name)
          setInputValue(mat.name)
        }
      }}
      isItemEqualToValue={(item, val) => item.id === val.id}
      itemToStringLabel={(mat) => mat.name}
      open={open}
      onOpenChange={setOpen}
    >
      <Combobox.InputGroup className="relative flex items-center">
        <Combobox.Input
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 py-1 pr-7 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          value={inputValue}
          onChange={(e) => setInputValue((e.target as HTMLInputElement).value)}
          placeholder="Select material…"
        />
        <Combobox.Trigger className="absolute right-1.5 text-muted-foreground">
          <ChevronDownIcon className="h-3.5 w-3.5" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup className="z-50 min-w-[180px] overflow-hidden rounded-xl border border-border bg-background shadow-md">
            <Combobox.List className="max-h-52 overflow-y-auto py-1">
              <Combobox.Empty className="px-3 py-2 text-[13px] text-muted-foreground">
                No materials found
              </Combobox.Empty>
              {filtered.map((mat) => (
                <Combobox.Item
                  key={mat.id}
                  value={mat}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted data-highlighted:bg-muted"
                >
                  <Combobox.ItemIndicator className="w-4">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </Combobox.ItemIndicator>
                  {mat.name}
                </Combobox.Item>
              ))}
              {/* Add new material option */}
              <div
                role="option"
                aria-selected={false}
                className="flex cursor-pointer items-center gap-2 border-t border-border px-3 py-1.5 text-[13px] text-primary hover:bg-muted"
                onClick={() => {
                  setOpen(false)
                  onAddNew()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setOpen(false)
                    onAddNew()
                  }
                }}
                tabIndex={0}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add new material…
              </div>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
