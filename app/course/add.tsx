import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { db } from '../../db/client';
import { subjects, faculty, venues, semesters } from '../../db/schema';
import { ArrowLeft, Save } from 'lucide-react-native';

export default function AddSubject() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [venueName, setVenueName] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      // Create faculty if provided
      let facultyId = null;
      if (facultyName.trim()) {
        const [fac] = await db.insert(faculty).values({
          name: facultyName.trim(),
        }).returning({ id: faculty.id });
        facultyId = fac.id;
      }

      // Create venue if provided
      let venueId = null;
      if (venueName.trim()) {
        const [ven] = await db.insert(venues).values({
          name: venueName.trim(),
        }).returning({ id: venues.id });
        venueId = ven.id;
      }

      // Get or create current semester
      const activeSemesters = await db.select().from(semesters).where({ isActive: true }).limit(1);
      let semesterId = null;
      if (activeSemesters.length > 0) {
        semesterId = activeSemesters[0].id;
      } else {
        const [newSem] = await db.insert(semesters).values({
          number: 4,
          name: 'Semester 4',
          isActive: true
        }).returning({ id: semesters.id });
        semesterId = newSem.id;
      }

      // Create subject
      await db.insert(subjects).values({
        name: name.trim(),
        code: code.trim(),
        facultyId,
        venueId,
        semesterId
      });

      router.back();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Subject</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Subject Name *</Text>
        <TextInput 
          style={styles.input} 
          placeholder="E.g. Database Management Systems" 
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Subject Code</Text>
        <TextInput 
          style={styles.input} 
          placeholder="E.g. CSE-301" 
          value={code}
          onChangeText={setCode}
        />

        <Text style={styles.label}>Faculty Name</Text>
        <TextInput 
          style={styles.input} 
          placeholder="E.g. Dr. Rakesh Kumar" 
          value={facultyName}
          onChangeText={setFacultyName}
        />

        <Text style={styles.label}>Venue / Room</Text>
        <TextInput 
          style={styles.input} 
          placeholder="E.g. New Block A-204" 
          value={venueName}
          onChangeText={setVenueName}
        />

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, !name.trim() && styles.buttonDisabled]} 
          onPress={handleSave}
          disabled={!name.trim()}
        >
          <Save color="#fff" size={20} style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>Save Subject</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
