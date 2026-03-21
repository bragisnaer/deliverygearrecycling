import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import path from 'path'

/**
 * Parse a CSV string into an array of row objects.
 * Headers are trimmed of leading/trailing whitespace.
 * Empty rows are skipped.
 */
export function parseCsv(content: string): Record<string, unknown>[] {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  })
  return result.data
}

/**
 * Parse an XLSX buffer into an array of row objects.
 * Row 1 is treated as headers. Date cells are preserved as Date objects.
 * Formula cells use their computed result value.
 */
export async function parseXlsx(
  buffer: Buffer
): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const rows: Record<string, unknown>[] = []
  const headers: string[] = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Extract headers from first row
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '').trim()
      })
      return
    }

    const rowObj: Record<string, unknown> = {}
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (!header) return

      let value: unknown
      if (cell.type === ExcelJS.ValueType.Date) {
        value = cell.value as Date
      } else if (cell.type === ExcelJS.ValueType.Formula) {
        // Formula cell — use the cached result
        const formulaValue = cell.value as ExcelJS.CellFormulaValue
        value = formulaValue.result
      } else {
        value = cell.value
      }
      rowObj[header] = value
    })
    rows.push(rowObj)
  })

  return rows
}

/**
 * Parse a file buffer into a { headers, rows } result.
 * Dispatches to parseCsv for .csv, parseXlsx for .xlsx / .xls.
 * Throws for any other file extension.
 */
export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const ext = path.extname(fileName).toLowerCase()

  if (ext === '.csv') {
    const rows = parseCsv(buffer.toString('utf-8'))
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    return { headers, rows }
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const rows = await parseXlsx(buffer)
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    return { headers, rows }
  }

  throw new Error(
    `Unsupported file type: ${ext}. Only CSV and XLSX are supported.`
  )
}
