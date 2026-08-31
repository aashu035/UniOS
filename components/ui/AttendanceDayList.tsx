import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { BookOpen, FlaskConical, Check, X, Clock, CalendarOff } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '../../tokens';
import { AttendanceOccurrenceView } from '../../domains/attendance/viewmodel';
import { AppCard } from '../cards/AppCard';
import { getLocalDateString } from '../../core/utils/date';

interface AttendanceDayListProps {
  date: string;
  occurrences: AttendanceOccurrenceView[];
  onMarkAttendance: (occurrence: AttendanceOccurrenceView) => void;
  isLoading?: boolean;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'present': return { color: (colors.light.attendanceStatus as any).present.color, icon: Check, label: 'Present' };
    case 'absent': return { color: (colors.light.attendanceStatus as any).absent.color, icon: X, label: 'Absent' };
    case 'exempt': return { color: (colors.light.attendanceStatus as any).exempt.color, icon: Clock, label: 'On Leave' };
    case 'cancelled': return { color: (colors.light.attendanceStatus as any).cancelled.color, icon: CalendarOff, label: 'Cancelled' };
    case 'upcoming': return { color: colors.light.textMuted, icon: Clock, label: 'Upcoming' };
    case 'unmarked': return { color: colors.light.warning, icon: null, label: 'Attendance not marked' };
    default: return { color: colors.light.textMuted, icon: null, label: status };
  }
};

export function AttendanceDayList({ date, occurrences, onMarkAttendance, isLoading }: AttendanceDayListProps) {
  const todayStr = getLocalDateString(new Date());
  
  let headerText = new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  if (date === todayStr) {
    headerText = `TODAY · ${headerText}`;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>{headerText}</Text>
        <AppCard style={styles.card} padding="lg">
          <Text style={styles.loadingText}>Loading...</Text>
        </AppCard>
      </View>
    );
  }

  if (occurrences.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>{headerText}</Text>
        <AppCard style={styles.card} padding="lg">
          <Text style={styles.emptyText}>No classes scheduled.</Text>
        </AppCard>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{headerText}</Text>
      
      {occurrences.map(occ => {
        const config = getStatusConfig(occ.status);
        const StatusIcon = config.icon;
        
        let TypeIcon = BookOpen;
        let typeLabel = 'Theory';
        if (occ.componentType === 'lab') {
          TypeIcon = FlaskConical;
          typeLabel = 'Lab';
        } else if (occ.componentType === 'tutorial') {
          TypeIcon = BookOpen;
          typeLabel = 'Tutorial';
        }
        
        return (
          <AppCard key={occ.occurrenceId} style={styles.card} padding="lg">
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{occ.startTime}–{occ.endTime}</Text>
            </View>
            <Text style={styles.courseName}>{occ.workspaceName}</Text>
            
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                {StatusIcon && <StatusIcon size={16} color={config.color} />}
                <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
              </View>
              
              <Text style={styles.dotSeparator}>·</Text>
              
              <View style={styles.typeContainer}>
                <TypeIcon size={14} color={colors.light.textMuted} />
                <Text style={styles.typeText}>{typeLabel}</Text>
              </View>
            </View>

            {occ.venueName && (
              <Text style={styles.venueText}>{occ.venueName}</Text>
            )}

            {occ.status === 'unmarked' && (
              <TouchableOpacity 
                style={styles.markButton} 
                onPress={() => onMarkAttendance(occ)}
              >
                <Text style={styles.markButtonText}>Mark Attendance</Text>
              </TouchableOpacity>
            )}
            
            {occ.status !== 'unmarked' && occ.status !== 'upcoming' && occ.status !== 'cancelled' && (
               <TouchableOpacity 
                 style={styles.editButton} 
                 onPress={() => onMarkAttendance(occ)}
               >
                 <Text style={styles.editButtonText}>Edit</Text>
               </TouchableOpacity>
            )}
          </AppCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  header: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  timeRow: {
    marginBottom: 4,
  },
  timeText: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
  courseName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  dotSeparator: {
    marginHorizontal: 8,
    color: colors.light.textMuted,
    fontWeight: typography.fontWeight.bold,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeText: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
  },
  venueText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginTop: 4,
  },
  emptyText: {
    color: colors.light.textMuted,
    fontSize: typography.fontSize.sm,
  },
  loadingText: {
    color: colors.light.textMuted,
    fontSize: typography.fontSize.sm,
  },
  markButton: {
    marginTop: spacing.md,
    backgroundColor: colors.light.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  markButtonText: {
    color: '#fff',
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  editButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    padding: spacing.xs,
  },
  editButtonText: {
    color: colors.light.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  }
});
