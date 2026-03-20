import { requireAuth } from '@/lib/auth-guard'
import { getGeneralSettings, getFacilities } from './actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GeneralSettingsForm } from './general-settings-form'
import { FacilitiesTable } from './facilities-table'
import { UsersTab } from './users-tab'
import { BrandingTab } from './branding-tab'

export default async function SettingsPage() {
  // Only reco-admin can access this page
  await requireAuth(['reco-admin'])

  const [settings, facilities] = await Promise.all([
    getGeneralSettings(),
    getFacilities(),
  ])

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
          System Settings
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Platform configuration. Accessible to reco-admin only.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general" className="font-mono text-[13px] font-medium">
            General
          </TabsTrigger>
          <TabsTrigger value="facilities" className="font-mono text-[13px] font-medium">
            Facilities
          </TabsTrigger>
          <TabsTrigger value="users" className="font-mono text-[13px] font-medium">
            Users
          </TabsTrigger>
          <TabsTrigger value="branding" className="font-mono text-[13px] font-medium">
            Branding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="pt-6 space-y-8">
          <GeneralSettingsForm settings={settings} />
        </TabsContent>

        <TabsContent value="facilities" className="pt-6">
          <FacilitiesTable facilities={facilities} />
        </TabsContent>

        <TabsContent value="users" className="pt-6">
          <UsersTab />
        </TabsContent>

        <TabsContent value="branding" className="pt-6">
          <BrandingTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
