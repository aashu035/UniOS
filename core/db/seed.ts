import { db } from './client';
import { dcrustGrading, semesters } from '../../domains/semester/model';
import { students } from '../../domains/profile/model';
import { faculty } from '../../domains/faculty/model';
import { venues } from '../../domains/venue/model';
import { workspaces, workspaceTimeline } from '../../domains/workspace/model';
import { tasks } from '../../domains/task/model';
import { resources } from '../../domains/resource/model';
import { attendance, portalAttendance } from '../../domains/attendance/model';
import { calendarEvents } from '../../domains/calendar/model';

export async function seedDcrustGrading() {
  const existing = await db.select().from(dcrustGrading).limit(1);
  if (existing.length === 0) {
    console.log("Seeding DCRUST grading scale...");
    await db.insert(dcrustGrading).values([
      { gradeLetter: 'O', gradePoint: 10.0, description: 'Outstanding' },
      { gradeLetter: 'A+', gradePoint: 9.0, description: 'Excellent' },
      { gradeLetter: 'A', gradePoint: 8.0, description: 'Very Good' },
      { gradeLetter: 'B+', gradePoint: 7.0, description: 'Good' },
      { gradeLetter: 'B', gradePoint: 6.0, description: 'Above Average' },
      { gradeLetter: 'C', gradePoint: 5.0, description: 'Average' },
      { gradeLetter: 'P', gradePoint: 4.0, description: 'Pass' },
      { gradeLetter: 'F', gradePoint: 0.0, description: 'Fail' },
      { gradeLetter: 'Ab', gradePoint: 0.0, description: 'Absent' },
    ]);
  }
}

export async function seedFullDatabase() {
  console.log("Seeding full database with realistic dummy data...");
  await seedDcrustGrading();

  // 1. Profile
  const existingStudents = await db.select().from(students).limit(1);
  if (existingStudents.length > 0) return; // Already seeded

  await db.insert(students).values({
    name: 'Harsh',
    enrollmentNo: '23001014022',
    university: 'DCRUST Murthal',
    branch: 'Computer Science and Engineering',
    currentSemester: 5,
    targetCgpa: 8.5,
  });

  // 2. Semester
  const [sem] = await db.insert(semesters).values({
    number: 5,
    name: 'Fall 2025',
    type: 'odd',
    isActive: true,
  }).returning();

  // 3. Faculty & Venues
  const [facSharma, facGupta, facVerma] = await db.insert(faculty).values([
    { name: 'Dr. Sharma', department: 'CSE', email: 'sharma@dcrust.edu.in' },
    { name: 'Prof. Gupta', department: 'CSE', email: 'gupta@dcrust.edu.in' },
    { name: 'Dr. Verma', department: 'ECE', email: 'verma@dcrust.edu.in' },
  ]).returning();

  const [ven304, venLab2, ven201] = await db.insert(venues).values([
    { name: 'Room 304', building: 'Block B', floor: '3rd' },
    { name: 'Lab 2', building: 'Block A', floor: '1st' },
    { name: 'Room 201', building: 'Block C', floor: '2nd' },
  ]).returning();

  // 4. Workspaces (Subjects)
  const insertedWorkspaces = await db.insert(workspaces).values([
    { semesterId: sem.id, name: 'Data Structures & Algorithms', code: 'CSE-301', facultyId: facSharma.id, venueId: ven304.id, color: '#6C5CE7', targetAttendance: 75.0, type: 'theory' },
    { semesterId: sem.id, name: 'Operating Systems', code: 'CSE-302', facultyId: facGupta.id, venueId: venLab2.id, color: '#0984E3', targetAttendance: 75.0, type: 'theory' },
    { semesterId: sem.id, name: 'Database Management Systems', code: 'CSE-303', facultyId: facVerma.id, venueId: ven201.id, color: '#00B894', targetAttendance: 75.0, type: 'theory' },
    { semesterId: sem.id, name: 'Software Engineering', code: 'CSE-304', facultyId: facSharma.id, venueId: ven304.id, color: '#E17055', targetAttendance: 75.0, type: 'theory' },
    { semesterId: sem.id, name: 'Web Technologies Lab', code: 'CSE-305', facultyId: facGupta.id, venueId: venLab2.id, color: '#FDCB6E', targetAttendance: 75.0, type: 'lab' },
  ]).returning();

  const wsDsa = insertedWorkspaces[0];
  const wsOs = insertedWorkspaces[1];
  const wsDbms = insertedWorkspaces[2];
  const wsSe = insertedWorkspaces[3];
  
  // 5. Tasks
  await db.insert(tasks).values([
    { workspaceId: wsDsa.id, title: 'Programming Assignment 3', type: 'assignment', dueDate: 'Tomorrow, 11:59 PM', priority: 'high', status: 'pending' },
    { workspaceId: wsDsa.id, title: 'Programming Assignment 2', type: 'assignment', dueDate: 'Last Week', status: 'graded', marksObtained: 18, marksTotal: 20 },
    { workspaceId: wsDsa.id, title: 'Programming Assignment 1', type: 'assignment', dueDate: '2 Weeks Ago', status: 'graded', marksObtained: 20, marksTotal: 20 },
    { workspaceId: wsOs.id, title: 'OS Assignment 2', type: 'assignment', dueDate: 'Tonight at 11:59 PM', priority: 'high', status: 'pending' },
    { workspaceId: wsDbms.id, title: 'Midterm Preparation Quiz', type: 'quiz', dueDate: 'Friday, 5:00 PM', priority: 'medium', status: 'pending' },
  ]);

  // 6. Resources
  await db.insert(resources).values([
    { workspaceId: wsDsa.id, title: 'Chapter 4: Trees & Graphs', type: 'pdf', uri: 'file://trees.pdf', sizeBytes: 2400000 },
    { workspaceId: wsDsa.id, title: 'Lecture 12 Recording', type: 'video', uri: 'file://lec12.mp4', sizeBytes: 142000000 },
    { workspaceId: wsDsa.id, title: 'Course Syllabus (2025-26)', type: 'pdf', uri: 'file://syllabus.pdf', sizeBytes: 450000 },
    { workspaceId: wsDsa.id, title: 'Data Structures by Seymour Lipschutz', type: 'link', uri: 'https://library.dcrust.edu.in' },
    { workspaceId: wsOs.id, title: 'Process Scheduling Notes', type: 'pdf', uri: 'file://scheduling.pdf', sizeBytes: 1500000 },
  ]);

  // 7. Attendance
  await db.insert(portalAttendance).values([
    { workspaceId: wsDsa.id, portalTotal: 40, portalPresent: 34, portalPercent: 85.0, checkedDate: 'Today' },
    { workspaceId: wsOs.id, portalTotal: 30, portalPresent: 28, portalPercent: 93.3, checkedDate: 'Today' },
    { workspaceId: wsDbms.id, portalTotal: 35, portalPresent: 25, portalPercent: 71.4, checkedDate: 'Today' },
    { workspaceId: wsSe.id, portalTotal: 45, portalPresent: 45, portalPercent: 100.0, checkedDate: 'Today' },
  ]);

  await db.insert(attendance).values([
    { workspaceId: wsDsa.id, date: 'Mon, 10th', status: 'present', notes: 'Prof. Sharma' },
    { workspaceId: wsDsa.id, date: 'Fri, 7th', status: 'absent', notes: 'Prof. Sharma' },
    { workspaceId: wsDsa.id, date: 'Wed, 5th', status: 'present', notes: 'Prof. Sharma' },
  ]);

  // 8. Timeline Events
  await db.insert(workspaceTimeline).values([
    { workspaceId: wsDsa.id, eventType: 'Knowledge Hub', title: 'Uploaded Slide Deck: Trees & Graphs', description: 'PDF • 2.4 MB' },
    { workspaceId: wsDsa.id, eventType: 'Tasks', title: 'Graded Assignment 2', description: 'Score: 18/20' },
    { workspaceId: wsDsa.id, eventType: 'Announcement', title: 'Midterm Syllabus Announced', description: 'Chapters 1-5' },
  ]);

  // 9. Timetable (Calendar)
  await db.insert(calendarEvents).values([
    { workspaceId: wsDsa.id, dayOfWeek: 1, startTime: '10:00', endTime: '11:00', type: 'lecture' },
    { workspaceId: wsOs.id, dayOfWeek: 1, startTime: '11:30', endTime: '12:30', type: 'lecture' },
    { workspaceId: wsDbms.id, dayOfWeek: 2, startTime: '09:00', endTime: '10:00', type: 'lecture' },
  ]);

  console.log("Database seeded successfully!");
}
