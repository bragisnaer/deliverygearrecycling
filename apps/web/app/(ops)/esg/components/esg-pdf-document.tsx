import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { MaterialWeightRow } from '@/lib/esg-calculator'

type EsgPdfDocumentProps = {
  data: {
    materials: MaterialWeightRow[]
    totalItems: number
    reuseRate: number
    co2: { value_kg: number | null; formula_pending: boolean }
  }
}

const styles = StyleSheet.create({
  page: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    padding: 40,
    color: '#111111',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 10,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  summaryValuePending: {
    fontSize: 12,
    fontFamily: 'Helvetica-Oblique',
    color: '#6B7280',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  colMaterial: {
    flex: 3,
  },
  colWeight: {
    flex: 2,
    textAlign: 'right',
  },
  colItems: {
    flex: 1,
    textAlign: 'right',
  },
  methodologyBox: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 10,
    backgroundColor: '#F9FAFB',
  },
  methodologyTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  methodologyText: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#374151',
    lineHeight: 1.5,
  },
  methodologyMono: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: '#111827',
    marginTop: 4,
    marginBottom: 4,
  },
})

export function EsgPdfDocument({ data }: EsgPdfDocumentProps) {
  const { materials, totalItems, reuseRate, co2 } = data
  const totalWeightKg = materials.reduce((sum, m) => sum + m.total_weight_kg, 0)
  const generatedDate = new Date().toISOString().split('T')[0]

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.title}>ESG Report — reco Platform</Text>
        <Text style={styles.subtitle}>Generated: {generatedDate}</Text>

        {/* Summary cards */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Items Processed</Text>
            <Text style={styles.summaryValue}>{totalItems.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Material Weight</Text>
            <Text style={styles.summaryValue}>{totalWeightKg.toFixed(1)} kg</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Reuse Rate</Text>
            <Text style={styles.summaryValue}>{reuseRate.toFixed(1)}%</Text>
          </View>
        </View>

        {/* CO2 Avoided */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>CO2 Avoided</Text>
          {co2.formula_pending ? (
            <Text style={styles.summaryValuePending}>
              Formula pending — to be defined
            </Text>
          ) : (
            <Text style={styles.summaryValue}>
              {co2.value_kg !== null ? `${co2.value_kg.toFixed(1)} kg` : '—'}
            </Text>
          )}
        </View>

        {/* Material breakdown table */}
        <Text style={styles.sectionTitle}>Material Breakdown</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colMaterial]}>Material</Text>
          <Text style={[styles.tableHeaderCell, styles.colWeight]}>Weight (kg)</Text>
          <Text style={[styles.tableHeaderCell, styles.colItems]}>Items</Text>
        </View>
        {materials.map((row) => (
          <View key={row.material_name} style={styles.tableRow}>
            <Text style={styles.colMaterial}>{row.material_name}</Text>
            <Text style={styles.colWeight}>{row.total_weight_kg.toLocaleString()}</Text>
            <Text style={styles.colItems}>{row.item_count.toLocaleString()}</Text>
          </View>
        ))}

        {/* Methodology */}
        <View style={styles.methodologyBox}>
          <Text style={styles.methodologyTitle}>Calculation Methodology</Text>
          <Text style={styles.methodologyText}>
            Material weights are calculated by joining intake line quantities with temporal product material compositions:
          </Text>
          <Text style={styles.methodologyMono}>
            Material weight (kg) = product_materials.weight_grams x intake_lines.actual_quantity / 1000
          </Text>
          <Text style={styles.methodologyText}>
            Rows are grouped by material type and voided records are excluded. Composition uses the effective material record active at the time of each delivery date.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
