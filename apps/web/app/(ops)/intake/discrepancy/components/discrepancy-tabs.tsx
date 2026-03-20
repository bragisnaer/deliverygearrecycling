'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type {
  DiscrepancyByCountry,
  DiscrepancyByFacility,
  DiscrepancyByProduct,
} from '../../actions'

// Monthly trend data per country: first 3 months vs last 3 months
function getTrendDirection(
  monthlyRates: { month: string; rate: number }[]
): 'up' | 'down' | 'neutral' {
  if (monthlyRates.length < 2) return 'neutral'
  const half = Math.floor(monthlyRates.length / 2)
  const first = monthlyRates.slice(0, half)
  const last = monthlyRates.slice(-half)
  const firstAvg = first.reduce((a, b) => a + b.rate, 0) / first.length
  const lastAvg = last.reduce((a, b) => a + b.rate, 0) / last.length
  if (lastAvg > firstAvg + 0.5) return 'up'
  if (lastAvg < firstAvg - 0.5) return 'down'
  return 'neutral'
}

function RateCell({ rate }: { rate: number }) {
  const isHigh = rate > 15
  return (
    <span
      className={
        isHigh ? 'font-semibold text-amber-700' : 'text-muted-foreground'
      }
    >
      {rate.toFixed(1)}%
    </span>
  )
}

type TrendData = {
  persistentFlag: boolean
  months: { month: string; rate: number }[]
}

type Props = {
  byCountry: DiscrepancyByCountry[]
  byProduct: DiscrepancyByProduct[]
  byFacility: DiscrepancyByFacility[]
  countryTrends: Record<string, TrendData>
}

export function DiscrepancyTabs({
  byCountry,
  byProduct,
  byFacility,
  countryTrends,
}: Props) {
  return (
    <Tabs defaultValue="country">
      <TabsList>
        <TabsTrigger value="country">By Country</TabsTrigger>
        <TabsTrigger value="product">By Product</TabsTrigger>
        <TabsTrigger value="facility">By Facility</TabsTrigger>
      </TabsList>

      {/* By Country */}
      <TabsContent value="country">
        {byCountry.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No discrepancy data available for the selected period.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Total Deliveries</TableHead>
                <TableHead className="text-right">Flagged</TableHead>
                <TableHead className="text-right">Discrepancy Rate</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCountry.map((row) => {
                const trend = countryTrends[row.country]
                const trendDir = trend
                  ? getTrendDirection(trend.months)
                  : 'neutral'
                const isPersistent = trend?.persistentFlag ?? false

                return (
                  <TableRow key={row.country}>
                    <TableCell className="font-medium">{row.country}</TableCell>
                    <TableCell className="text-right">
                      {row.total_deliveries}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.flagged_count}
                    </TableCell>
                    <TableCell className="text-right">
                      <RateCell rate={row.discrepancy_rate_pct} />
                    </TableCell>
                    <TableCell>
                      {trendDir === 'up' && (
                        <TrendingUp className="size-4 text-destructive" />
                      )}
                      {trendDir === 'down' && (
                        <TrendingDown className="size-4 text-muted-foreground" />
                      )}
                      {trendDir === 'neutral' && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isPersistent && (
                        <Badge variant="destructive">Persistent Issue</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      {/* By Product */}
      <TabsContent value="product">
        {byProduct.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No discrepancy data available for the selected period.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Total Lines</TableHead>
                <TableHead className="text-right">Flagged Lines</TableHead>
                <TableHead className="text-right">Discrepancy Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProduct.map((row) => (
                <TableRow key={row.product_name}>
                  <TableCell className="font-medium">
                    {row.product_name}
                  </TableCell>
                  <TableCell className="text-right">{row.total_lines}</TableCell>
                  <TableCell className="text-right">
                    {row.flagged_lines}
                  </TableCell>
                  <TableCell className="text-right">
                    <RateCell rate={row.discrepancy_rate_pct} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      {/* By Facility */}
      <TabsContent value="facility">
        {byFacility.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No discrepancy data available for the selected period.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility</TableHead>
                <TableHead className="text-right">Total Deliveries</TableHead>
                <TableHead className="text-right">Flagged</TableHead>
                <TableHead className="text-right">Discrepancy Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byFacility.map((row) => (
                <TableRow key={row.facility_name}>
                  <TableCell className="font-medium">
                    {row.facility_name}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.total_deliveries}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.flagged_count}
                  </TableCell>
                  <TableCell className="text-right">
                    <RateCell rate={row.discrepancy_rate_pct} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>
    </Tabs>
  )
}
