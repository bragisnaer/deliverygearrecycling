'use client'

import { useState, useCallback } from 'react'
import type { ImportSource } from '@/lib/import-sources'
import { commitImport } from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ValidationError {
  row: number
  field: string
  message: string
}

interface UploadResult {
  jobId: string
  totalRows: number
  validRows: number
  errorCount: number
  errors: ValidationError[]
  headers: string[]
}

type Step = 'upload' | 'mapping' | 'preview' | 'committed'

interface ExistingJob {
  id: string
  status: string
  total_rows: number
  valid_rows: number
  error_count: number
  errors_json: string
  column_mapping_json: string | null
}

interface ImportWizardProps {
  source: ImportSource
  tenants: { id: string; name: string }[]
  existingJob?: ExistingJob | null
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'mapping', label: 'Map Columns' },
  { key: 'preview', label: 'Preview' },
  { key: 'committed', label: 'Done' },
]

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current)
  return (
    <ol className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isActive = step.key === current
        const isDone = i < currentIndex
        return (
          <li key={step.key} className="flex items-center">
            <span
              className={[
                'flex h-7 w-7 items-center justify-center rounded-full font-mono text-[12px] font-semibold',
                isActive
                  ? 'bg-foreground text-background'
                  : isDone
                    ? 'bg-muted text-muted-foreground line-through'
                    : 'border border-border bg-background text-muted-foreground',
              ].join(' ')}
            >
              {i + 1}
            </span>
            <span
              className={[
                'ml-1.5 font-mono text-[12px]',
                isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
              ].join(' ')}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-3 text-border">›</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function ImportWizard({ source, tenants, existingJob }: ImportWizardProps) {
  // Determine initial step from existingJob
  const getInitialStep = (): Step => {
    if (!existingJob) return 'upload'
    if (existingJob.status === 'committed') return 'committed'
    if (existingJob.status === 'ready' || existingJob.status === 'has_errors') return 'preview'
    return 'upload'
  }

  const [step, setStep] = useState<Step>(getInitialStep)
  const [selectedTenant, setSelectedTenant] = useState<string>(tenants[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [jobId, setJobId] = useState<string>(existingJob?.id ?? '')
  const [totalRows, setTotalRows] = useState<number>(existingJob?.total_rows ?? 0)
  const [validRows, setValidRows] = useState<number>(existingJob?.valid_rows ?? 0)
  const [errors, setErrors] = useState<ValidationError[]>(() => {
    if (existingJob?.errors_json) {
      try {
        return JSON.parse(existingJob.errors_json) as ValidationError[]
      } catch {
        return []
      }
    }
    return []
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)

  // ── Auto-mapping helper ───────────────────────────────────────────────────

  const buildAutoMapping = useCallback(
    (hdrs: string[]): Record<string, string> => {
      const allFields = [
        ...source.fields,
        ...(source.lineFields ?? []),
      ]
      const mapping: Record<string, string> = {}
      for (const hdr of hdrs) {
        const normalised = hdr.trim().toLowerCase()
        const match = allFields.find(
          (f) => f.key.toLowerCase() === normalised || f.label.toLowerCase() === normalised
        )
        if (match) {
          mapping[hdr] = match.key
        }
      }
      return mapping
    },
    [source]
  )

  // ── Step 1: Upload ────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!file || !selectedTenant) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('source', source.id)
      fd.append('tenantId', selectedTenant)
      // First pass: no column mapping — get raw headers

      const res = await fetch('/api/import/upload', { method: 'POST', body: fd })
      const data = (await res.json()) as UploadResult & { error?: string }
      if (!res.ok) {
        setUploadError(data.error ?? 'Upload failed')
        return
      }
      setHeaders(data.headers)
      setJobId(data.jobId)
      setTotalRows(data.totalRows)
      // Apply auto-mapping
      const autoMap = buildAutoMapping(data.headers)
      setColumnMapping(autoMap)
      setStep('mapping')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsUploading(false)
    }
  }

  // ── Step 2: Column mapping → re-upload with mapping ──────────────────────

  const allRequiredFieldsMapped = (): boolean => {
    const requiredKeys = [
      ...source.fields.filter((f) => f.required).map((f) => f.key),
      ...(source.lineFields?.filter((f) => f.required).map((f) => f.key) ?? []),
    ]
    const mappedValues = Object.values(columnMapping)
    return requiredKeys.every((k) => mappedValues.includes(k))
  }

  const handlePreviewValidation = async () => {
    if (!file || !selectedTenant) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('source', source.id)
      fd.append('tenantId', selectedTenant)
      fd.append('columnMapping', JSON.stringify(columnMapping))

      const res = await fetch('/api/import/upload', { method: 'POST', body: fd })
      const data = (await res.json()) as UploadResult & { error?: string }
      if (!res.ok) {
        setUploadError(data.error ?? 'Validation failed')
        return
      }
      setJobId(data.jobId)
      setTotalRows(data.totalRows)
      setValidRows(data.validRows)
      setErrors(data.errors)
      setStep('preview')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsUploading(false)
    }
  }

  const applyDefaultMapping = () => {
    const autoMap = buildAutoMapping(headers)
    setColumnMapping(autoMap)
  }

  // ── Step 3: Commit ────────────────────────────────────────────────────────

  const handleCommit = async () => {
    if (!jobId || validRows === 0) return
    setIsCommitting(true)
    setCommitError(null)
    try {
      const result = await commitImport(jobId)
      setImportedCount(result.importedCount)
      setStep('committed')
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Commit failed')
    } finally {
      setIsCommitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      {/* Step indicator */}
      <div className="mb-6">
        <StepIndicator current={step} />
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">
            Upload File — {source.name}
          </h2>
          <p className="text-sm text-muted-foreground">{source.description}</p>

          {/* Tenant selector */}
          <div className="space-y-1">
            <label htmlFor="tenant-select" className="font-mono text-[13px] font-semibold">
              Target Tenant
            </label>
            <select
              id="tenant-select"
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {tenants.length === 0 && (
                <option value="" disabled>
                  No tenants available
                </option>
              )}
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* File input */}
          <div className="space-y-1">
            <label htmlFor="file-input" className="font-mono text-[13px] font-semibold">
              File (CSV or XLSX)
            </label>
            <input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:font-mono file:text-[13px] file:font-semibold file:text-foreground hover:file:bg-muted"
            />
          </div>

          {uploadError && (
            <p className="rounded-md bg-red-50 px-3 py-2 font-mono text-[13px] text-red-700">
              {uploadError}
            </p>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || !selectedTenant || isUploading}
            className="rounded-md bg-foreground px-4 py-2 font-mono text-[13px] font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading ? 'Uploading…' : 'Upload & Parse'}
          </button>
        </div>
      )}

      {/* ── Step 2: Column Mapping ── */}
      {step === 'mapping' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Map Columns</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyDefaultMapping}
                className="rounded-md border border-input bg-background px-3 py-1.5 font-mono text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Use Default Mapping
              </button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Map each spreadsheet column to the corresponding platform field.
            Required fields are marked with <span className="font-mono text-red-600">*</span>.
          </p>

          {/* Platform fields → spreadsheet header mapping */}
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold">
                    Platform Field
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold">
                    Spreadsheet Column
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...source.fields,
                  ...(source.hasLines && source.lineFields ? source.lineFields : []),
                ].map((field) => {
                  // Find which header maps to this field key
                  const mappedHeader = Object.entries(columnMapping).find(
                    ([, v]) => v === field.key
                  )?.[0]
                  const isMapped = !!mappedHeader
                  return (
                    <tr key={field.key} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-[13px]">
                        {field.label}
                        {field.required && (
                          <span className="ml-1 text-red-600">*</span>
                        )}
                        {field.description && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {field.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={mappedHeader ?? ''}
                          onChange={(e) => {
                            const newHeader = e.target.value
                            setColumnMapping((prev) => {
                              const next = { ...prev }
                              // Remove any existing mapping pointing to this field
                              for (const [k, v] of Object.entries(next)) {
                                if (v === field.key) delete next[k]
                              }
                              // Add new mapping if not "-- Skip --"
                              if (newHeader) {
                                next[newHeader] = field.key
                              }
                              return next
                            })
                          }}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">-- Skip --</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 font-mono text-[12px]">
                        {isMapped ? (
                          <span className="text-green-600">Mapped</span>
                        ) : field.required ? (
                          <span className="text-yellow-600">Required</span>
                        ) : (
                          <span className="text-muted-foreground">Optional</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {uploadError && (
            <p className="rounded-md bg-red-50 px-3 py-2 font-mono text-[13px] text-red-700">
              {uploadError}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="rounded-md border border-input bg-background px-4 py-2 font-mono text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handlePreviewValidation}
              disabled={!allRequiredFieldsMapped() || isUploading}
              className="rounded-md bg-foreground px-4 py-2 font-mono text-[13px] font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUploading ? 'Validating…' : 'Preview Validation'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Validation Preview ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Validation Preview</h2>

          {/* Summary banner */}
          {errors.length === 0 ? (
            <div className="rounded-md bg-green-50 px-4 py-3 font-mono text-[13px] text-green-800">
              All {totalRows} rows valid. Ready to import.
            </div>
          ) : validRows > 0 ? (
            <div className="rounded-md bg-amber-50 px-4 py-3 font-mono text-[13px] text-amber-800">
              {validRows} of {totalRows} rows will be imported.{' '}
              {errors.length} row{errors.length !== 1 ? 's' : ''} will be skipped due to errors.
            </div>
          ) : (
            <div className="rounded-md bg-red-50 px-4 py-3 font-mono text-[13px] text-red-800">
              No valid rows found. {errors.length} error{errors.length !== 1 ? 's' : ''} found.
              Please fix your data and re-upload.
            </div>
          )}

          {/* Error table */}
          {errors.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold">
                        Row #
                      </th>
                      <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold">
                        Field
                      </th>
                      <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.slice(0, 100).map((err, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-2 font-mono text-[13px] text-muted-foreground">
                          {err.row}
                        </td>
                        <td className="px-4 py-2 font-mono text-[13px]">{err.field}</td>
                        <td className="px-4 py-2 text-[13px] text-red-700">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errors.length > 100 && (
                <p className="border-t border-border px-4 py-2 font-mono text-[12px] text-muted-foreground">
                  and {errors.length - 100} more...
                </p>
              )}
            </div>
          )}

          {commitError && (
            <p className="rounded-md bg-red-50 px-3 py-2 font-mono text-[13px] text-red-700">
              {commitError}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setHeaders([])
                setColumnMapping({})
                setJobId('')
                setErrors([])
                setStep('upload')
              }}
              className="rounded-md border border-input bg-background px-4 py-2 font-mono text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Re-upload
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={validRows === 0 || isCommitting}
              className="rounded-md bg-foreground px-4 py-2 font-mono text-[13px] font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCommitting ? 'Committing…' : `Commit Import (${validRows} rows)`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Committed ── */}
      {step === 'committed' && (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Import Complete</h2>
          <div className="rounded-md bg-green-50 px-4 py-3 font-mono text-[13px] text-green-800">
            Import complete.{' '}
            {importedCount > 0 ? importedCount : validRows} records imported from{' '}
            {source.name}.
          </div>
          <p className="font-mono text-[12px] text-muted-foreground">
            Job ID: {jobId}
          </p>
          <a
            href="/import"
            className="inline-block rounded-md border border-input bg-background px-4 py-2 font-mono text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Back to Import Hub
          </a>
        </div>
      )}
    </div>
  )
}
