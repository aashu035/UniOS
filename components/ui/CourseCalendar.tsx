import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '../../tokens/colors';
import { spacing, radius } from '../../tokens';
import { getLocalDateString } from '../../core/utils/date';

export type CalendarDayData = {
  date: string; // YYYY-MM-DD
  occurrences: {
    id: string;
    type: 'theory' | 'lab' | 'tutorial' | string;
    attendance?: {
      status: 'present' | 'absent' | 'exempt' | 'cancelled';
    };
  }[];
};

interface CourseCalendarProps {
  days: CalendarDayData[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  baseMonthStr?: string; // YYYY-MM-DD to control currently viewed month
  onMonthChange?: (newMonthStr: string) => void;
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 is Sunday

export const CourseCalendar: React.FC<CourseCalendarProps> = ({
  days,
  selectedDate,
  onSelectDate,
  baseMonthStr,
  onMonthChange,
}) => {
  // Use either provided month or selected date's month, fallback to today
  const initialDateStr = baseMonthStr || selectedDate || getLocalDateString(new Date());
  const [currentDate, setCurrentDate] = useState(new Date(initialDateStr));
  const [gridWidth, setGridWidth] = useState(0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    const nextDate = new Date(year, month - 1, 1);
    setCurrentDate(nextDate);
    onMonthChange?.(getLocalDateString(nextDate));
  };

  const handleNextMonth = () => {
    const nextDate = new Date(year, month + 1, 1);
    setCurrentDate(nextDate);
    onMonthChange?.(getLocalDateString(nextDate));
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfMonth(year, month);
  
  const gridDays = [];
  // Fill empty spaces for first week
  for (let i = 0; i < firstDayOfWeek; i++) {
    gridDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, '0');
    const mStr = String(month + 1).padStart(2, '0');
    gridDays.push(`${year}-${mStr}-${dStr}`);
  }

  const renderIndicator = (occurrence: CalendarDayData['occurrences'][0], index: number) => {
    const typeColor = occurrence.type === 'theory' ? (colors.light.attendanceType as any).theory.color : 
                     occurrence.type === 'lab' ? (colors.light.attendanceType as any).lab.color : colors.light.primaryMuted;
    
    let statusColor = null;
    if (occurrence.attendance?.status) {
      statusColor = (colors.light.attendanceStatus as any)[occurrence.attendance.status].color;
    }

    const initial = occurrence.type === 'theory' ? 'T' : occurrence.type === 'lab' ? 'L' : 'O';

    return (
      <View key={occurrence.id} style={[styles.indicator, {
        borderColor: typeColor,
        backgroundColor: statusColor || 'transparent',
      }]}>
        <Text style={[styles.indicatorText, { color: statusColor ? '#FFF' : typeColor }]}>
          {initial}
        </Text>
      </View>
    );
  };

  const renderDay = (dateStr: string | null, index: number, colWidth: number) => {
    if (!dateStr) {
      return <View key={`empty-${index}`} style={[styles.dayCell, { width: colWidth, height: colWidth }]} />;
    }

    const dayNumber = parseInt(dateStr.split('-')[2], 10);
    const dayData = days.find(d => d.date === dateStr);
    const isSelected = selectedDate === dateStr;
    const hasOccurrences = dayData && dayData.occurrences.length > 0;

    let cellBg = 'transparent';
    
    if (isSelected) {
      cellBg = colors.light.primary + '20'; // Primary transparent
    }

    return (
      <TouchableOpacity
        key={dateStr}
        style={[styles.dayCell, {
          width: colWidth,
          height: colWidth,
          opacity: hasOccurrences ? 1 : 0.4, 
          backgroundColor: cellBg 
        }]}
        onPress={() => onSelectDate(dateStr)}
        disabled={!hasOccurrences}
      >
        <Text style={[styles.dayText, isSelected ? styles.dayTextSelected : styles.dayTextNormal]}>
          {dayNumber}
        </Text>
        <View style={styles.indicatorContainer}>
          {hasOccurrences && dayData.occurrences.map((occ, idx) => renderIndicator(occ, idx))}
        </View>
      </TouchableOpacity>
    );
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const columnWidth = gridWidth > 0 ? Math.floor(gridWidth / 7) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.headerButton}>
          <ChevronLeft size={20} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {monthNames[month]} {year}
        </Text>
        <TouchableOpacity onPress={handleNextMonth} style={styles.headerButton}>
          <ChevronRight size={20} color={colors.light.text} />
        </TouchableOpacity>
      </View>

      {/* Grid Container wrapper for geometry measurement */}
      <View 
        style={styles.calendarInner}
        onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
      >
        {gridWidth > 0 && (
          <>
            {/* Weekdays */}
            <View style={styles.weekdaysRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <View key={idx} style={[styles.weekdayCell, { width: columnWidth }]}>
                  <Text style={styles.weekdayText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Grid */}
            <View style={styles.gridContainer}>
              {gridDays.map((day, idx) => renderDay(day, idx, columnWidth))}
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.light.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.light.text,
  },
  calendarInner: {
    width: '100%',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekdayCell: {
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  dayText: {
    fontSize: 14,
  },
  dayTextNormal: {
    color: colors.light.text,
  },
  dayTextSelected: {
    fontWeight: 'bold',
    color: colors.light.primary,
  },
  indicatorContainer: {
    flexDirection: 'row',
    marginTop: 4,
    height: 16,
  },
  indicator: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  indicatorText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
});
