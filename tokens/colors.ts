export const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F8F9FA',
    surfaceElevated: '#FFFFFF',
    text: '#111827',
    textMuted: '#6B7280',
    primary: '#1d61e7',     // From Stitch mockups (was Apple/Linear #111827)
    primaryMuted: '#60a5fa',
    accent: '#0066CC',
    border: '#E5E7EB',
    danger: '#DC2626',
    success: '#10b981',     // From Stitch
    warning: '#f59e0b',     // From Stitch
    attendanceStatus: {
      present: { color: '#16A34A', border: '#86EFAC', bg: '#F0FDF4' },
      absent: { color: '#DC2626', border: '#FCA5A5', bg: '#FEF2F2' },
      exempt: { color: '#D97706', border: '#FCD34D', bg: '#FFFBEB' },
      cancelled: { color: '#4B5563', border: '#D1D5DB', bg: '#F3F4F6' }
    },
    attendanceType: {
      theory: { color: '#2563EB', bg: '#EFF6FF' },
      lab: { color: '#CA8A04', bg: '#FEFCE8' }
    },
    calendar: {
      weekdayGroupA: '#F0FDF4',
      weekdayGroupB: '#F5F3FF'
    }
  },
  dark: {
    background: '#09090B',
    surface: '#18181B',
    surfaceElevated: '#27272A',
    text: '#FAFAFA',
    textMuted: '#A1A1AA',
    primary: '#3B82F6',
    primaryMuted: '#2563EB',
    accent: '#60A5FA',
    border: '#27272A',
    danger: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
    attendanceStatus: {
      present: { color: '#22C55E', border: '#14532D', bg: '#052E16' },
      absent: { color: '#EF4444', border: '#7F1D1D', bg: '#450A0A' },
      exempt: { color: '#F59E0B', border: '#78350F', bg: '#451A03' },
      cancelled: { color: '#9CA3AF', border: '#374151', bg: '#1F2937' }
    },
    attendanceType: {
      theory: { color: '#60A5FA', bg: '#1E3A8A' },
      lab: { color: '#FCD34D', bg: '#713F12' }
    },
    calendar: {
      weekdayGroupA: '#052E16',
      weekdayGroupB: '#2E1065'
    }
  },
  subjects: [
    { base: '#3B82F6', bg: '#EFF6FF' }, // Blue
    { base: '#10B981', bg: '#ECFDF5' }, // Green
    { base: '#F59E0B', bg: '#FFFBEB' }, // Yellow/Orange
    { base: '#8B5CF6', bg: '#F5F3FF' }, // Purple
    { base: '#EF4444', bg: '#FEF2F2' }, // Red
    { base: '#06B6D4', bg: '#ECFEFF' }, // Cyan
    { base: '#F43F5E', bg: '#FFF1F2' }, // Rose
  ]
};
