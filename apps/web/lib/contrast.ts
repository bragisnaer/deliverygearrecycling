import { hex as hexContrast, score } from 'wcag-contrast'

type ContrastPair = { fg: string; bg: string; label: string }

/**
 * Validate WCAG AA contrast for colour pairs.
 * Returns null if all pairs pass, or an error string describing the first failure.
 *
 * Uses wcag-contrast: hex() returns the contrast ratio, score() classifies it.
 * score() returns 'AAA' | 'AA' | 'AA Large' | 'Fail'
 * 'Fail' = below 3:1 (fails WCAG AA for normal text which requires 4.5:1)
 * 'AA Large' = 3–4.5:1 (only passes for large text, not normal text)
 *
 * We reject anything below 'AA' (ratio < 4.5:1) for normal body text.
 */
export function checkBrandingContrast(pairs: ContrastPair[]): string | null {
  for (const { fg, bg, label } of pairs) {
    if (!fg || !bg) continue
    const ratio = hexContrast(fg, bg)
    const result = score(ratio)
    if (result === 'Fail' || result === 'AA Large') {
      return `Colour combination fails WCAG AA contrast: ${label} (${fg} on ${bg}). Minimum ratio is 4.5:1 for normal text — current ratio is ${ratio.toFixed(2)}:1.`
    }
  }
  return null
}
