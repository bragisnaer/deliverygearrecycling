import { requireAuth } from '@/lib/auth-guard'
import { getGeneralSettings, getFacilities } from './actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GeneralSettingsForm } from './general-settings-form'
import { FacilitiesTable } from './facilities-table'

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
        </TabsList>

        <TabsContent value="general" className="pt-6 space-y-8">
          <GeneralSettingsForm settings={settings} />
        </TabsContent>

        <TabsContent value="facilities" className="pt-6">
          <FacilitiesTable facilities={facilities} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
