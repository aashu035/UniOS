import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '../../tokens';
import { AttendanceDaySummary } from '../../domains/attendance/viewmodel';
import { getLocalDateString } from '../../core/utils/date';

interface AttendanceWeekStripProps {
  days: AttendanceDaySummary[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  weekStartDate: string;
  weekEndDate: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

const getShortDayName = (dateStr: string) => {
  const d = new Date(dateStr);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
};

const getDayNumber = (dateStr: string) => {
  return new Date(dateStr).getDate().toString();
};

const formatWeekRange = (start: string, end: string) => {
  const d1 = new Date(start);
  const d2 = new Date(end);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  
  if (d1.getMonth() === d2.getMonth()) {
    return `${d1.getDate()} — ${d2.toLocaleDateString('en-GB', options)}`;
  }
  return `${d1.toLocaleDateString('en-GB', options)} — ${d2.toLocaleDateString('en-GB', options)}`;
};

export function AttendanceWeekStrip({
  days,
  selectedDate,
  onSelectDate,
  weekStartDate,
  weekEndDate,
  onPreviousWeek,
  onNextWeek
}: AttendanceWeekStripProps) {
  const todayStr = getLocalDateString(new Date());

  return (
    <View style={styles.container}>
      {/* Header / Week Pager */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.chevron} onPress={onPreviousWeek}>
          <ChevronLeft color={colors.light.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.weekText}>{formatWeekRange(weekStartDate, weekEndDate)}</Text>
        <TouchableOpacity style={styles.chevron} onPress={onNextWeek}>
          <ChevronRight color={colors.light.text} size={24} />
        </TouchableOpacity>
      </View>

      {/* Days Strip */}
      <View style={styles.daysRow}>
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === todayStr;

          return (
            <TouchableOpacity 
              key={day.date} 
              style={[
                styles.dayCell, 
                isSelected && styles.dayCellSelected
              ]}
              onPress={() => onSelectDate(day.date)}
            >
              <Text style={[
                styles.dayName, 
                isSelected && styles.textSelected,
                isToday && !isSelected && styles.textToday
              ]}>
                {getShortDayName(day.date)}
              </Text>
              <Text style={[
                styles.dayNum, 
                isSelected && styles.textSelected,
                isToday && !isSelected && styles.textToday
              ]}>
                {getDayNumber(day.date)}
              </Text>
              
              {/* Dot Indicators */}
              <View style={styles.dotContainer}>
                {day.hasClasses ? (
                  <View style={[
                    styles.dot, 
                    day.isAllMarked 
                      ? { backgroundColor: (colors.light.attendanceStatus as any).present.color } 
                      : day.hasUnmarkedPast
                        ? { backgroundColor: colors.light.warning }
                        : { backgroundColor: colors.light.border }
                  ]} />
                ) : (
                  <View style={styles.dotEmpty} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.light.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  weekText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.text,
  },
  chevron: {
    padding: spacing.xs,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    minWidth: 40,
  },
  dayCellSelected: {
    backgroundColor: colors.light.primary + '15',
  },
  dayName: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginBottom: 4,
  },
  dayNum: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.text,
    marginBottom: 6,
  },
  textSelected: {
    color: colors.light.primary,
    fontWeight: typography.fontWeight.bold,
  },
  textToday: {
    color: colors.light.primary,
  },
  dotContainer: {
    height: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotEmpty: {
    width: 6,
    height: 6,
  }
});
