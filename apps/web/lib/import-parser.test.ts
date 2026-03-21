import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseCsv, parseXlsx, parseFile } from './import-parser'

describe('import-parser', () => {
  describe('parseCsv', () => {
    it('parses a simple 3-column CSV string into an array of objects', () => {
      const csv = 'name,age,city\nAlice,30,Copenhagen\nBob,25,Aarhus'
      const rows = parseCsv(csv)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toEqual({ name: 'Alice', age: '30', city: 'Copenhagen' })
      expect(rows[1]).toEqual({ name: 'Bob', age: '25', city: 'Aarhus' })
    })

    it('trims whitespace from header names', () => {
      const csv = '  name  , age ,  city  \nAlice,30,Copenhagen'
      const rows = parseCsv(csv)
      expect(rows).toHaveLength(1)
      expect(Object.keys(rows[0])).toEqual(['name', 'age', 'city'])
    })

    it('handles quoted fields containing commas', () => {
      const csv = 'name,address\nAlice,"123 Main St, Apt 4"\nBob,"456 Oak Ave, Suite 1"'
      const rows = parseCsv(csv)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({ name: 'Alice', address: '123 Main St, Apt 4' })
      expect(rows[1]).toMatchObject({ name: 'Bob', address: '456 Oak Ave, Suite 1' })
    })

    it('skips empty rows and returns fewer objects', () => {
      const csv = 'name,age\nAlice,30\n\n\nBob,25\n'
      const rows = parseCsv(csv)
      expect(rows).toHaveLength(2)
    })
  })

  describe('parseXlsx', () => {
    async function buildXlsxBuffer(
      headers: string[],
      dataRows: (string | number | Date)[][]
    ): Promise<Buffer> {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Sheet1')
      sheet.addRow(headers)
      for (const row of dataRows) {
        sheet.addRow(row)
      }
      const arrayBuffer = await workbook.xlsx.writeBuffer()
      return Buffer.from(arrayBuffer)
    }

    it('returns array of objects with headers from row 1', async () => {
      const buffer = await buildXlsxBuffer(
        ['name', 'age', 'city'],
        [['Alice', 30, 'Copenhagen'], ['Bob', 25, 'Aarhus']]
      )
      const rows = await parseXlsx(buffer)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({ name: 'Alice', age: 30, city: 'Copenhagen' })
      expect(rows[1]).toMatchObject({ name: 'Bob', age: 25, city: 'Aarhus' })
    })

    it('handles an XLSX with a single data row', async () => {
      const buffer = await buildXlsxBuffer(
        ['product', 'quantity'],
        [['jacket', 100]]
      )
      const rows = await parseXlsx(buffer)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ product: 'jacket', quantity: 100 })
    })
  })

  describe('parseFile', () => {
    it('dispatches to parseCsv for .csv files', async () => {
      const csv = 'name,value\nfoo,42'
      const buffer = Buffer.from(csv, 'utf-8')
      const result = await parseFile(buffer, 'data.csv')
      expect(result.rows).toHaveLength(1)
      expect(result.headers).toContain('name')
      expect(result.headers).toContain('value')
    })

    it('dispatches to parseXlsx for .xlsx files', async () => {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Sheet1')
      sheet.addRow(['col1', 'col2'])
      sheet.addRow(['a', 'b'])
      const arrayBuffer = await workbook.xlsx.writeBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const result = await parseFile(buffer, 'report.xlsx')
      expect(result.rows).toHaveLength(1)
      expect(result.headers).toEqual(['col1', 'col2'])
    })

    it('throws for unsupported file extensions (.pdf)', async () => {
      const buffer = Buffer.from('irrelevant content')
      await expect(parseFile(buffer, 'document.pdf')).rejects.toThrow(
        'Unsupported file type'
      )
    })

    it('throws for unsupported file extensions (.txt)', async () => {
      const buffer = Buffer.from('some text')
      await expect(parseFile(buffer, 'notes.txt')).rejects.toThrow(
        'Unsupported file type'
      )
    })
  })
})
