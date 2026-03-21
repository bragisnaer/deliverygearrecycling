import { describe, it, expect } from 'vitest'
import {
  sumMaterialWeights,
  calculateReuseRate,
  calculateCO2Avoided,
  serializeEsgCsv,
  type MaterialWeightRow,
} from '@/lib/esg-calculator'

// ─── sumMaterialWeights ────────────────────────────────────────────────────

describe('sumMaterialWeights', () => {
  it('1000 bike bags produce correct material weights (ESG-02)', () => {
    const lines = [
      { actual_quantity: 1000, weight_grams: 943, material_name: 'Polypropylene' },
      { actual_quantity: 1000, weight_grams: 386, material_name: 'PVC' },
      { actual_quantity: 1000, weight_grams: 296, material_name: 'PE+Aluminium' },
      { actual_quantity: 1000, weight_grams: 294, material_name: 'Polyester' },
      { actual_quantity: 1000, weight_grams: 292, material_name: 'Foam' },
      { actual_quantity: 1000, weight_grams: 260, material_name: 'Remains' },
      { actual_quantity: 1000, weight_grams: 98,  material_name: 'Cotton-polyester' },
      { actual_quantity: 1000, weight_grams: 54,  material_name: 'Zipper Metal' },
      { actual_quantity: 1000, weight_grams: 37,  material_name: 'POM' },
      { actual_quantity: 1000, weight_grams: 15,  material_name: 'Metal Screws' },
      { actual_quantity: 1000, weight_grams: 4,   material_name: 'Copper' },
      { actual_quantity: 1000, weight_grams: 1,   material_name: 'Nylon' },
    ]

    const result = sumMaterialWeights(lines)

    // All 12 materials present
    expect(result).toHaveLength(12)

    // Spot-check anchor values (ESG-02)
    const polypropylene = result.find((r) => r.material_name === 'Polypropylene')
    expect(polypropylene?.total_weight_kg).toBe(943)

    const pvc = result.find((r) => r.material_name === 'PVC')
    expect(pvc?.total_weight_kg).toBe(386)

    const polyester = result.find((r) => r.material_name === 'Polyester')
    expect(polyester?.total_weight_kg).toBe(294)

    const peAl = result.find((r) => r.material_name === 'PE+Aluminium')
    expect(peAl?.total_weight_kg).toBe(296)

    const foam = result.find((r) => r.material_name === 'Foam')
    expect(foam?.total_weight_kg).toBe(292)

    const remains = result.find((r) => r.material_name === 'Remains')
    expect(remains?.total_weight_kg).toBe(260)

    const cottonPoly = result.find((r) => r.material_name === 'Cotton-polyester')
    expect(cottonPoly?.total_weight_kg).toBe(98)

    const zipperMetal = result.find((r) => r.material_name === 'Zipper Metal')
    expect(zipperMetal?.total_weight_kg).toBe(54)

    const pom = result.find((r) => r.material_name === 'POM')
    expect(pom?.total_weight_kg).toBe(37)

    const metalScrews = result.find((r) => r.material_name === 'Metal Screws')
    expect(metalScrews?.total_weight_kg).toBe(15)

    const copper = result.find((r) => r.material_name === 'Copper')
    expect(copper?.total_weight_kg).toBe(4)

    const nylon = result.find((r) => r.material_name === 'Nylon')
    expect(nylon?.total_weight_kg).toBe(1)
  })

  it('empty input returns empty array', () => {
    const result = sumMaterialWeights([])
    expect(result).toEqual([])
  })

  it('aggregates shared materials across products', () => {
    // Polyester from bike bag (294g × 100) + car bag (555g × 100)
    // = (294 * 100 / 1000) + (555 * 100 / 1000) = 29.4 + 55.5 = 84.9 kg
    const lines = [
      { actual_quantity: 100, weight_grams: 294, material_name: 'Polyester' },
      { actual_quantity: 100, weight_grams: 555, material_name: 'Polyester' },
    ]

    const result = sumMaterialWeights(lines)

    expect(result).toHaveLength(1)
    expect(result[0].material_name).toBe('Polyester')
    expect(result[0].total_weight_kg).toBe(84.9)
  })

  it('results sorted descending by total_weight_kg', () => {
    const lines = [
      { actual_quantity: 10, weight_grams: 100, material_name: 'Light' },
      { actual_quantity: 10, weight_grams: 500, material_name: 'Heavy' },
      { actual_quantity: 10, weight_grams: 300, material_name: 'Medium' },
    ]

    const result = sumMaterialWeights(lines)

    expect(result[0].material_name).toBe('Heavy')
    expect(result[1].material_name).toBe('Medium')
    expect(result[2].material_name).toBe('Light')
  })

  it('item_count tracks number of lines aggregated per material', () => {
    const lines = [
      { actual_quantity: 50, weight_grams: 100, material_name: 'Polyester' },
      { actual_quantity: 50, weight_grams: 200, material_name: 'Polyester' },
    ]

    const result = sumMaterialWeights(lines)

    expect(result[0].item_count).toBe(2)
  })
})

// ─── calculateReuseRate ───────────────────────────────────────────────────

describe('calculateReuseRate', () => {
  it('returns 0 when totalProcessed is 0 (avoid division by zero)', () => {
    expect(calculateReuseRate(0, 0)).toBe(0)
  })

  it('returns 25.0 for 250 reused out of 1000 total', () => {
    expect(calculateReuseRate(1000, 250)).toBe(25.0)
  })

  it('returns 33.3 for 333 reused out of 1000 total', () => {
    expect(calculateReuseRate(1000, 333)).toBe(33.3)
  })
})

// ─── calculateCO2Avoided ─────────────────────────────────────────────────

describe('calculateCO2Avoided', () => {
  it('returns formula_pending: true when formulaConfig is null', () => {
    const result = calculateCO2Avoided([], null)
    expect(result).toEqual({ value_kg: null, formula_pending: true })
  })

  it('returns formula_pending: true when formulaConfig is provided (stub)', () => {
    const materialRows: MaterialWeightRow[] = [
      { material_name: 'Polypropylene', total_weight_kg: 943, item_count: 1000 },
    ]
    const result = calculateCO2Avoided(materialRows, { Polypropylene: 1.8 })
    expect(result).toEqual({ value_kg: null, formula_pending: true })
  })

  it('returns value_kg: null regardless of input', () => {
    const result = calculateCO2Avoided([], { any: 1 })
    expect(result.value_kg).toBeNull()
  })
})

// ─── serializeEsgCsv ─────────────────────────────────────────────────────

describe('serializeEsgCsv', () => {
  it('header row is "Material,Total Weight (kg),Item Count"', () => {
    const lines = serializeEsgCsv([]).split('\n')
    expect(lines[0]).toBe('Material,Total Weight (kg),Item Count')
  })

  it('produces correct number of lines (header + data rows)', () => {
    const rows: MaterialWeightRow[] = [
      { material_name: 'Polypropylene', total_weight_kg: 943, item_count: 1000 },
      { material_name: 'PVC', total_weight_kg: 386, item_count: 1000 },
    ]
    const lines = serializeEsgCsv(rows).split('\n')
    expect(lines).toHaveLength(3) // 1 header + 2 data
  })

  it('material names with commas are double-quoted', () => {
    const rows: MaterialWeightRow[] = [
      { material_name: 'PE+Aluminium, coated', total_weight_kg: 296, item_count: 500 },
    ]
    const csv = serializeEsgCsv(rows)
    const lines = csv.split('\n')
    // Data line must quote the material name containing a comma
    expect(lines[1]).toBe('"PE+Aluminium, coated",296,500')
  })

  it('data row values match the MaterialWeightRow fields', () => {
    const rows: MaterialWeightRow[] = [
      { material_name: 'Polyester', total_weight_kg: 294, item_count: 1000 },
    ]
    const lines = serializeEsgCsv(rows).split('\n')
    expect(lines[1]).toBe('"Polyester",294,1000')
  })
})
