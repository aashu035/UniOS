import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Book, Briefcase, PieChart, Clock, MoreVertical } from 'lucide-react-native';
import { colors } from '../theme/colors';

type ClassCardProps = {
  subject: string;
  code: string;
  time: string;
  room: string;
  prof: string;
  iconType?: 'book' | 'briefcase' | 'piechart';
  iconColorIndex?: number;
};

export default function ClassCard({ 
  subject, 
  code, 
  time, 
  room, 
  prof, 
  iconType = 'book',
  iconColorIndex = 0
}: ClassCardProps) {
  
  const iconConfigs = [
    { color: '#6958d9', bg: '#efedff' },
    { color: '#d05a7f', bg: '#ffedf3' },
    { color: '#009d80', bg: '#e8faf4' }
  ];
  
  const iconStyle = iconConfigs[iconColorIndex % 3];
  
  const renderIcon = () => {
    switch (iconType) {
      case 'briefcase': return <Briefcase size={20} color={iconStyle.color} />;
      case 'piechart': return <PieChart size={20} color={iconStyle.color} />;
      default: return <Book size={20} color={iconStyle.color} />;
    }
  };

  // Get initials for faculty avatar
  const initials = prof.split(' ').slice(-2).map(n => n[0]).join('').toUpperCase();

  return (
    <View style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: iconStyle.bg }]}>
        {renderIcon()}
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.subjectText}>{subject}</Text>
        <Text style={styles.codeText}>{code}</Text>
        <View style={styles.detailsRow}>
          <Clock size={12} color="#8172cf" style={styles.clockIcon} />
          <Text style={styles.detailsText}>{time}</Text>
          <View style={styles.dot} />
          <Text style={styles.detailsText}>{room}</Text>
        </View>
      </View>

      <View style={styles.facultyContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <MoreVertical size={20} color="#aaa5b5" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#302c5a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  subjectText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  codeText: {
    fontSize: 11,
    color: '#948fa3',
    marginBottom: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clockIcon: {
    marginRight: 4,
  },
  detailsText: {
    fontSize: 10,
    color: '#716c80',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#c4bfcc',
    marginHorizontal: 6,
  },
  facultyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#d8d2ea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6553a3',
  },
  moreButton: {
    padding: 4,
  }
});
