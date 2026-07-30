import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { colors } from '../theme/colors';

type TaskItemProps = {
  title: string;
  subtitle: string;
  due: string;
  colorTheme: 'teal' | 'amber' | 'rose' | 'indigo';
  completed: boolean;
  onToggle: () => void;
};

export default function TaskItem({ title, subtitle, due, colorTheme, completed, onToggle }: TaskItemProps) {
  const getBorderColor = () => {
    switch (colorTheme) {
      case 'teal': return colors.taskTeal;
      case 'amber': return colors.taskAmber;
      case 'rose': return colors.taskRose;
      case 'indigo': return colors.taskIndigo;
      default: return colors.primary;
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.taskItem, { borderLeftColor: getBorderColor() }]} 
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.checkContainer}>
        {completed ? (
          <CheckCircle2 size={20} color="#32b9a9" />
        ) : (
          <Circle size={20} color="#8a849a" />
        )}
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={[styles.title, completed && styles.completedText]}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.due}>{due}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  taskItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#2a245c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  checkContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#96919e',
  },
  subtitle: {
    fontSize: 10,
    color: '#8d8998',
    marginTop: 4,
    lineHeight: 14,
  },
  due: {
    fontSize: 9,
    color: '#6b6576',
    fontWeight: '500',
    marginTop: 6,
  }
});
