/**
 * Premium surface presets — "metallic glass" aesthetic.
 * Pure StyleSheet values (no native gradient dependency needed): layered tonal
 * fills + hairline top highlight + soft elevation produce the brushed-metal /
 * glassy sheen seen in high-end banking apps, without extra native deps.
 *
 * Usage: spread the desired preset into a style array, e.g.
 *   style={[glassCard.primary, localOverride]}
 */

import { colors } from './colors';

// Soft, layered shadow tuned for a floating, premium feel.
const premiumShadow = {
  shadowColor: '#0B1B3B',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.10,
  shadowRadius: 16,
  elevation: 6,
};

// Hairline highlight on the top edge (the "glass" catch-light).
const topHighlight = {
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.55)',
};

export const glassCard = {
  // Primary branded surface: deep blue metallic gradient simulated via stacked fills.
  primary: {
    backgroundColor: colors.light.primary,
    borderRadius: 20,
    ...topHighlight,
    ...premiumShadow,
  },
  // Neutral elevated glass: white with a faint blue inner tint.
  neutral: {
    backgroundColor: colors.light.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    ...topHighlight,
    ...premiumShadow,
  },
  // Subtle surface for inset sections.
  inset: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.05)',
  },
};
