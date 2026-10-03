import { useColorScheme } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

/**
 * UniOS redesign tokens (Claude Design project "Data organization and
 * visualization redesign"). Mirrors the CSS variables in `UniOS App.dc.html`.
 */
export type UniPalette = {
  bg: string;
  elev: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  hair: string;
  primary: string;
  primarySoft: string;
  success: string;
  danger: string;
  warn: string;
  off: string;
  glass: string;
  scrim: string;
  dark: boolean;
};

export const light: UniPalette = {
  bg: '#F5F6F8',
  elev: '#FFFFFF',
  surface: '#EEF0F4',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  hair: 'rgba(17,24,39,0.07)',
  primary: '#1d61e7',
  primarySoft: 'rgba(29,97,231,0.10)',
  success: '#16A34A',
  danger: '#DC2626',
  warn: '#D97706',
  off: '#6B7280',
  glass: 'rgba(255,255,255,0.92)',
  scrim: 'rgba(9,9,11,0.42)',
  dark: false,
};

export const dark: UniPalette = {
  bg: '#09090B',
  elev: '#18181B',
  surface: '#27272A',
  text: '#FAFAFA',
  muted: '#A1A1AA',
  border: '#27272A',
  hair: 'rgba(255,255,255,0.07)',
  primary: '#3B82F6',
  primarySoft: 'rgba(59,130,246,0.18)',
  success: '#22C55E',
  danger: '#EF4444',
  warn: '#F59E0B',
  off: '#9CA3AF',
  glass: 'rgba(24,24,27,0.92)',
  scrim: 'rgba(0,0,0,0.55)',
  dark: true,
};

/** Fixed category colours used for class / lab / due blocks and quick actions. */
export const hue = {
  blue: '#3B82F6',
  green: '#10B981',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  red: '#EF4444',
  cyan: '#06B6D4',
  gray: '#6B7280',
};

/** Knowledge Hub file types: PDFs red, notes green, images amber, links violet. */
export const FILE_COLORS = { pdf: hue.red, note: hue.green, image: hue.amber, link: hue.violet, other: hue.gray } as const;

export function useUni(): UniPalette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** `color-mix(in srgb, c pct%, transparent)` for #RRGGBB colours. */
export function tint(color: string, pct = 14): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${pct / 100})`;
}

type Weight = 400 | 500 | 600 | 700 | 800;
const SANS: Record<Weight, string> = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
};

/** Font family for a weight. Each weight is its own family under expo-font. */
export function sans(weight: Weight = 400): TextStyle {
  return { fontFamily: SANS[weight] };
}

export function mono(weight: 500 | 700 = 500): TextStyle {
  return { fontFamily: weight === 700 ? 'JetBrainsMono_700Bold' : 'JetBrainsMono_500Medium' };
}

export function shadow(p: UniPalette): ViewStyle {
  return p.dark
    ? { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 }
    : { shadowColor: '#0B1B3B', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 };
}

/**
 * Shared spacing. Screens inset content by `screenX`; cards pad by `card`;
 * rows inside list cards use `listRow`. Change spacing here, not per screen.
 */
export const space = { screenX: 20, card: 14, rowX: 14, rowY: 12, gap: 12 } as const;
export const listRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: space.gap, paddingVertical: space.rowY, paddingHorizontal: space.rowX };

/** Top padding under the status bar, and bottom padding that clears the tab bar. */
export const SCREEN_TOP = 8;
export const TAB_CLEARANCE = 124;
