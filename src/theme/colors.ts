// Dark high-contrast palette tuned for shop-floor lighting and gloved hands.
// Severity colors deliberately bold; backgrounds deliberately near-black.

export const colors = {
  // Surfaces
  bg: '#0A0E14',
  bgElevated: '#141A22',
  bgCard: '#1A2230',
  bgPressed: '#243042',
  border: '#2A3548',
  divider: '#1F2937',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0A0E14',

  // Severity
  ok: '#10B981',
  okBg: 'rgba(16, 185, 129, 0.15)',
  okBorder: 'rgba(16, 185, 129, 0.40)',

  watch: '#F59E0B',
  watchBg: 'rgba(245, 158, 11, 0.15)',
  watchBorder: 'rgba(245, 158, 11, 0.40)',

  act: '#EF4444',
  actBg: 'rgba(239, 68, 68, 0.18)',
  actBorder: 'rgba(239, 68, 68, 0.50)',

  unknown: '#6B7280',
  unknownBg: 'rgba(107, 114, 128, 0.15)',
  unknownBorder: 'rgba(107, 114, 128, 0.40)',

  // Sensor accents (used for sparklines)
  sensor: {
    temp: '#F87171',
    pressure: '#A78BFA',
    airflow: '#60A5FA',
    vibration: '#FBBF24',
    power: '#34D399',
  },

  // Accents
  accent: '#3B82F6',
  accentPressed: '#2563EB',
  peerReference: '#475569', // Faint line for "peer median" reference on raw sparklines
} as const;

export type SeverityColor = 'ok' | 'watch' | 'act' | 'unknown';

export const severityPalette = (s: SeverityColor) => ({
  fg: colors[s],
  bg: colors[`${s}Bg` as const],
  border: colors[`${s}Border` as const],
});
