export const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

export const ALLOWED_FONTS = [
  'system-ui',
  'Inter',
  'DM Sans',
  'Lato',
  'Nunito',
  'Roboto',
  'Source Sans 3',
] as const

export type AllowedFont = (typeof ALLOWED_FONTS)[number]
