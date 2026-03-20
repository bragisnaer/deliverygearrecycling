'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function PrisonHomePage() {
  const t = useTranslations('intake.home')

  return (
    <div className="flex flex-col gap-8">
      {/* Primary CTA */}
      <div className="flex flex-col items-center gap-4 pt-8">
        <Link
          href="/prison/incoming"
          className="inline-flex min-h-[48px] min-w-[280px] items-center justify-center rounded-md border-2 border-foreground bg-primary px-10 py-4 font-mono text-base font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
        >
          {t('primary_cta')}
        </Link>
        <Link
          href="/prison/processing/new"
          className="inline-flex min-h-[48px] min-w-[280px] items-center justify-center rounded-md border-2 border-foreground bg-secondary px-10 py-4 font-mono text-base font-medium text-secondary-foreground transition-opacity hover:opacity-90 active:opacity-80"
        >
          {t('processing_cta')}
        </Link>
      </div>

      {/* Tabs: Expected Deliveries + History */}
      <Tabs defaultValue="deliveries" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="deliveries" className="flex-1">
            {t('deliveries_tab')}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            {t('history_tab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deliveries" className="mt-4">
          <p className="text-sm text-muted-foreground">{t('no_deliveries')}</p>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <p className="text-sm text-muted-foreground">{t('no_history')}</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
