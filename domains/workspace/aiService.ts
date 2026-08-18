import { ParsedClassSession, TimetableParser } from '../../core/ai/timetableParser';
import { WorkspaceRepository } from './repository';
import { CalendarRepository, NewCalendarEvent } from '../calendar/repository';

export class AITimetableService {
  /**
   * Parse the image and commit the schedule to the database in one go.
   */
  static async importTimetable(imageUri: string, userBatch: string): Promise<ParsedClassSession[]> {
    // 1. Parse using AI
    const sessions = await TimetableParser.parseTimetableImage(imageUri, userBatch);
    
    // 2. Map Day of Week
    const daysMap: Record<string, number> = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6
    };

    // 3. Fetch existing workspaces to avoid duplicates
    const existingWorkspaces = await WorkspaceRepository.getAllWorkspaces();
    const workspaceIdMap = new Map<string, number>();
    
    for (const ws of existingWorkspaces) {
      if (ws.code) {
        workspaceIdMap.set(ws.code.toUpperCase(), ws.id);
      }
    }

    const eventsToCreate: NewCalendarEvent[] = [];

    // 4. Process each parsed session
    for (const session of sessions) {
      const code = session.subjectCode.toUpperCase();
      let workspaceId = workspaceIdMap.get(code);

      if (!workspaceId) {
        // Create new workspace if not found
        let credits = 3;
        if (session.type === 'lab') credits = 1;
        if (session.type === 'tutorial') credits = 1;

        const newWs = await WorkspaceRepository.buildCompleteWorkspace({
          name: code,
          code: code,
          credits: credits,
          color: '#3B82F6',
          components: [
            {
              type: (session.type === 'theory' || session.type === 'tutorial' || session.type === 'lab') ? session.type : 'theory',
              durationMinutes: session.type === 'lab' ? 120 : 60,
              venueName: session.venue,
              facultyName: session.faculty,
              sessions: [{
                dayOfWeek: daysMap[session.day] ?? 1,
                startTime: session.startTime,
                endTime: session.endTime,
              }]
            }
          ]
        });

        workspaceIdMap.set(code, newWs.id);
      }
    }

    return sessions;
  }
}
