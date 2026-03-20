declare module 'wcag-contrast' {
  /**
   * Get the contrast ratio between two relative luminance values.
   */
  export function luminance(a: number, b: number): number

  /**
   * Get the contrast ratio between two colours as RGB triplets [r, g, b].
   */
  export function rgb(a: number[], b: number[]): number

  /**
   * Get the contrast ratio between two hex colour strings (e.g. '#000000', '#ffffff').
   * Returns a number (e.g. 21 for black on white).
   */
  export function hex(a: string, b: string): number

  /**
   * Classify a numeric contrast ratio as a WCAG score.
   * Returns 'AAA' (>=7), 'AA' (>=4.5), 'AA Large' (>=3), or 'Fail' (<3).
   */
  export function score(contrast: number): 'AAA' | 'AA' | 'AA Large' | 'Fail'
}
