import { auth } from '@/auth'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require('@react-pdf/renderer') as {
  renderToBuffer: (element: unknown) => Promise<Buffer>
}
import { createElement } from 'react'
import { EsgPdfDocument } from '../components/esg-pdf-document'
import { getEsgData, getProcessingStreamCounts } from '../actions'
import { serializeEsgCsv, calculateReuseRate } from '@/lib/esg-calculator'

export async function GET(request: Request) {
  const session = await auth()
  const role = session?.user?.role
  if (role !== 'reco-admin' && role !== 'reco') {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'pdf'
  const tenantFilter = searchParams.get('tenant') ?? undefined

  const [esgData, streamCounts] = await Promise.all([
    getEsgData(tenantFilter),
    getProcessingStreamCounts(tenantFilter),
  ])
  const reuseRate = calculateReuseRate(streamCounts.total_qty, streamCounts.reuse_qty)

  if (format === 'csv') {
    const csv = serializeEsgCsv(esgData.materials)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="esg-report-${Date.now()}.csv"`,
      },
    })
  }

  const element = createElement(EsgPdfDocument, { data: { ...esgData, reuseRate } })
  const buffer: Buffer = await renderToBuffer(element)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="esg-report-${Date.now()}.pdf"`,
    },
  })
}
