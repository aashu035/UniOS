import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FileText, BookOpen, DollarSign, ChevronRight } from 'lucide-react-native';
import { colors } from '../theme/colors';

type DeadlineCardProps = {
  subject: string;
  task: string;
  time: string;
  date: string;
  iconType: 'filetext' | 'bookopen' | 'dollarsign';
};

export default function DeadlineCard({ subject, task, time, date, iconType }: DeadlineCardProps) {
  const renderIcon = () => {
    switch (iconType) {
      case 'bookopen': return <BookOpen size={18} color={colors.primary} />;
      case 'dollarsign': return <DollarSign size={18} color={colors.primary} />;
      default: return <FileText size={18} color={colors.primary} />;
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        {renderIcon()}
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.subjectText}>
          {subject} <Text style={styles.taskText}>· {task}</Text>
        </Text>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{time}</Text>
          <View style={styles.dot} />
          <Text style={styles.timeText}>{date}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.chevronButton}>
        <ChevronRight size={18} color="#aaa5b5" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#302c5a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f2efff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  contentContainer: {
    flex: 1,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  taskText: {
    color: '#9691a3',
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 10,
    color: '#827d8e',
    fontWeight: '500',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#c4bfcc',
    marginHorizontal: 6,
  },
  chevronButton: {
    padding: 4,
  }
});
