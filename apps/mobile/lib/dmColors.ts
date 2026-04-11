export const DM_COLOR_PALETTE = [
  { hex: '#c8860a', label: 'Amber'  },
  { hex: '#93b4f8', label: 'Blue'   },
  { hex: '#f0a0c8', label: 'Pink'   },
  { hex: '#6ee7b7', label: 'Teal'   },
  { hex: '#c4b5fd', label: 'Violet' },
  { hex: '#fbbf24', label: 'Yellow' },
  { hex: '#fca5a5', label: 'Red'    },
  { hex: '#e4e0cc', label: 'White'  },
] as const

export const DM_FONT_SIZES = {
  sm: { px: 12, label: 'S' },
  md: { px: 14, label: 'M' },
  lg: { px: 17, label: 'L' },
} as const

export type DMColor = typeof DM_COLOR_PALETTE[number]['hex']
export type DMFontSize = keyof typeof DM_FONT_SIZES

export const VALID_DM_COLORS = DM_COLOR_PALETTE.map((c) => c.hex)
