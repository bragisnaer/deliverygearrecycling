'use client'

import { useState, useCallback } from 'react'
import { ALLOWED_FONTS } from '@/lib/branding-constants'
import { saveBranding, getBranding } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

// --- Types ---

type Tenant = { id: string; name: string }

interface BrandingFormProps {
  tenants: Tenant[]
}

type BrandingState = {
  logo_url: string
  favicon_url: string
  primary_color: string
  secondary_color: string
  background_color: string
  foreground_color: string
  accent_color: string
  heading_font: string
  body_font: string
}

const EMPTY_BRANDING: BrandingState = {
  logo_url: '',
  favicon_url: '',
  primary_color: '',
  secondary_color: '',
  background_color: '',
  foreground_color: '',
  accent_color: '',
  heading_font: '',
  body_font: '',
}

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

// --- Colour field component ---

function ColourField({
  label,
  id,
  value,
  onChange,
  placeholder,
}: {
  label: string
  id: string
  value: string
  onChange: (val: string) => void
  placeholder: string
}) {
  const isValidHex = value === '' || HEX_REGEX.test(value)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        {/* Colour swatch */}
        <div
          className="size-8 shrink-0 rounded border border-input"
          style={{
            backgroundColor: HEX_REGEX.test(value) ? value : 'transparent',
          }}
          aria-hidden="true"
        />
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={!isValidHex ? 'border-destructive' : ''}
          maxLength={7}
        />
      </div>
      {!isValidHex && (
        <p className="text-[12px] text-destructive">Must be a valid 6-digit hex colour (e.g. #ED1C24)</p>
      )}
    </div>
  )
}

// --- Font select component ---

function FontField({
  label,
  id,
  value,
  onChange,
}: {
  label: string
  id: string
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">— inherit default —</option>
        {ALLOWED_FONTS.map((font) => (
          <option key={font} value={font} style={{ fontFamily: font }}>
            {font}
          </option>
        ))}
      </select>
    </div>
  )
}

// --- Live preview panel ---

function LivePreview({
  form,
  tenantName,
}: {
  form: BrandingState
  tenantName: string
}) {
  // Build inline CSS variables from current form state — same pattern as buildBrandingStyle
  const previewStyle: React.CSSProperties = {
    ...(HEX_REGEX.test(form.primary_color) ? { '--primary': form.primary_color } : {}),
    ...(HEX_REGEX.test(form.secondary_color) ? { '--secondary': form.secondary_color } : {}),
    ...(HEX_REGEX.test(form.background_color) ? { '--background': form.background_color } : {}),
    ...(HEX_REGEX.test(form.foreground_color) ? { '--foreground': form.foreground_color } : {}),
    ...(HEX_REGEX.test(form.accent_color) ? { '--accent': form.accent_color } : {}),
    ...(form.heading_font ? { '--font-heading': `'${form.heading_font}', sans-serif` } : {}),
    ...(form.body_font ? { '--font-sans': `'${form.body_font}', sans-serif` } : {}),
  } as React.CSSProperties

  return (
    <div
      className="rounded-lg border border-input bg-background p-6 space-y-4"
      style={previewStyle}
    >
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-4">
        Live preview
      </p>

      {/* Tenant name as heading */}
      <h2
        className="font-heading text-[18px] font-semibold leading-[1.2]"
        style={{ color: 'var(--foreground)' }}
      >
        {tenantName || 'Tenant name'}
      </h2>

      {/* Body text */}
      <p className="text-[14px]" style={{ color: 'var(--foreground)' }}>
        Sample body text showing font and colour. Deliveries tracked from booking to invoice.
      </p>

      {/* Primary button */}
      <button
        type="button"
        className="rounded px-4 py-2 text-[13px] font-mono font-medium border-2 border-black"
        style={{
          backgroundColor: HEX_REGEX.test(form.primary_color)
            ? form.primary_color
            : 'var(--primary)',
          color: 'var(--primary-foreground, #fff)',
        }}
      >
        Primary button
      </button>

      {/* Accent link */}
      <p className="text-[14px]">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          style={{
            color: HEX_REGEX.test(form.accent_color) ? form.accent_color : 'var(--accent)',
          }}
        >
          Accent link example
        </a>
      </p>
    </div>
  )
}

// --- Main form ---

export function BrandingForm({ tenants }: BrandingFormProps) {
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [form, setForm] = useState<BrandingState>(EMPTY_BRANDING)
  const [loadingTenant, setLoadingTenant] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId)

  // Load existing branding when tenant changes
  const handleTenantChange = useCallback(async (tenantId: string) => {
    setSelectedTenantId(tenantId)
    setError(null)
    setSuccess(false)

    if (!tenantId) {
      setForm(EMPTY_BRANDING)
      return
    }

    setLoadingTenant(true)
    try {
      const branding = await getBranding(tenantId)
      if (branding) {
        setForm({
          logo_url: branding.logo_url ?? '',
          favicon_url: branding.favicon_url ?? '',
          primary_color: branding.primary_color ?? '',
          secondary_color: branding.secondary_color ?? '',
          background_color: branding.background_color ?? '',
          foreground_color: branding.foreground_color ?? '',
          accent_color: branding.accent_color ?? '',
          heading_font: branding.heading_font ?? '',
          body_font: branding.body_font ?? '',
        })
      } else {
        setForm(EMPTY_BRANDING)
      }
    } catch {
      setError('Failed to load branding for this tenant.')
    } finally {
      setLoadingTenant(false)
    }
  }, [])

  function setField(field: keyof BrandingState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
    setSuccess(false)
  }

  async function handleSave() {
    if (!selectedTenantId) {
      setError('Please select a tenant before saving.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await saveBranding({
        tenant_id: selectedTenantId,
        logo_url: form.logo_url || null,
        favicon_url: form.favicon_url || null,
        primary_color: form.primary_color || null,
        secondary_color: form.secondary_color || null,
        background_color: form.background_color || null,
        foreground_color: form.foreground_color || null,
        accent_color: form.accent_color || null,
        heading_font: form.heading_font || null,
        body_font: form.body_font || null,
      })

      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error ?? 'Failed to save branding.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tenant selector */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-select">Tenant</Label>
            <select
              id="tenant-select"
              value={selectedTenantId}
              onChange={(e) => handleTenantChange(e.target.value)}
              className="h-8 w-full max-w-[320px] rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">— select a tenant —</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>

          {tenants.length === 0 && (
            <p className="text-[14px] text-muted-foreground">
              No active tenants found. Create a tenant before configuring branding.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Branding config — only shown when a tenant is selected */}
      {selectedTenantId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: form fields */}
          <Card>
            <CardHeader>
              <CardTitle>
                {loadingTenant ? 'Loading…' : `${selectedTenant?.name ?? selectedTenantId} — Branding`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* URLs */}
              <div className="space-y-1.5">
                <Label htmlFor="logo-url">Logo URL</Label>
                <Input
                  id="logo-url"
                  type="url"
                  placeholder="https://example.com/logo.svg"
                  value={form.logo_url}
                  onChange={(e) => setField('logo_url', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="favicon-url">Favicon URL</Label>
                <Input
                  id="favicon-url"
                  type="url"
                  placeholder="https://example.com/favicon.ico"
                  value={form.favicon_url}
                  onChange={(e) => setField('favicon_url', e.target.value)}
                />
              </div>

              {/* Colours */}
              <div className="pt-2">
                <p className="mb-3 text-[13px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
                  Colours
                </p>
                <div className="space-y-4">
                  <ColourField
                    label="Primary colour"
                    id="primary-color"
                    value={form.primary_color}
                    onChange={(v) => setField('primary_color', v)}
                    placeholder="#ED1C24"
                  />
                  <ColourField
                    label="Secondary colour"
                    id="secondary-color"
                    value={form.secondary_color}
                    onChange={(v) => setField('secondary_color', v)}
                    placeholder="#9FA4A6"
                  />
                  <ColourField
                    label="Background colour"
                    id="background-color"
                    value={form.background_color}
                    onChange={(v) => setField('background_color', v)}
                    placeholder="#FAF9F4"
                  />
                  <ColourField
                    label="Foreground / text colour"
                    id="foreground-color"
                    value={form.foreground_color}
                    onChange={(v) => setField('foreground_color', v)}
                    placeholder="#000000"
                  />
                  <ColourField
                    label="Accent colour"
                    id="accent-color"
                    value={form.accent_color}
                    onChange={(v) => setField('accent_color', v)}
                    placeholder="#ED1C24"
                  />
                </div>
              </div>

              {/* Fonts */}
              <div className="pt-2">
                <p className="mb-3 text-[13px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
                  Fonts
                </p>
                <div className="space-y-4">
                  <FontField
                    label="Heading font"
                    id="heading-font"
                    value={form.heading_font}
                    onChange={(v) => setField('heading_font', v)}
                  />
                  <FontField
                    label="Body font"
                    id="body-font"
                    value={form.body_font}
                    onChange={(v) => setField('body_font', v)}
                  />
                </div>
              </div>

              {/* Save area */}
              <div className="pt-2 space-y-3">
                {error && (
                  <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="rounded border border-green-600/30 bg-green-50 px-3 py-2 text-[13px] text-green-700">
                    Branding saved successfully.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loadingTenant}
                    className="font-mono text-[13px] font-medium min-h-[44px]"
                  >
                    {saving ? 'Saving…' : 'Save branding'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right: live preview */}
          <div>
            <LivePreview form={form} tenantName={selectedTenant?.name ?? ''} />
          </div>
        </div>
      )}
    </div>
  )
}
