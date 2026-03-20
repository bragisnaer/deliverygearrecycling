import { getTenants } from './actions'
import { BrandingForm } from './branding-form'

export async function BrandingTab() {
  const tenantsList = await getTenants()
  return <BrandingForm tenants={tenantsList} />
}
