import { GoogleGenAI, Type } from '@google/genai';
import * as FileSystem from 'expo-file-system/legacy';
import { AIProviderKeysStore } from '../settings/aiProviders';

export interface ParsedClassSession {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string; // e.g. "08:00 AM"
  endTime: string;   // e.g. "08:55 AM"
  subjectCode: string; // e.g. "ES", "CN", "PP"
  type: 'theory' | 'lab' | 'tutorial';
  venue?: string;      // e.g. "JCB-213"
  faculty?: string;    // e.g. "VF-5"
}

export class TimetableParser {
  static async parseTimetableImage(imageUri: string, userBatch: string = ''): Promise<ParsedClassSession[]> {
    const keys = await AIProviderKeysStore.getKeys();
    
    if (!keys.gemini) {
      throw new Error('Gemini API key is not configured. Please add it in Settings > AI Provider Keys.');
    }

    const ai = new GoogleGenAI({ apiKey: keys.gemini });

    // Read the image as base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const prompt = `You are an expert AI system for university scheduling. 
Your task is to extract timetable data from the provided image and output a structured list of class sessions.

STRICT PARSING RULES:
1. Grid Traversal Strategy: Scan the timetable horizontally (row-wise), processing one day at a time (e.g., from Monday to Friday).
2. Time Slots: Map each cell in a day's row to its corresponding column header time block (e.g., 8:00 AM - 8:55 AM).
3. Empty Slots: Blank cells indicate free time and MUST be skipped. No classes are scheduled if the cell is empty.
4. Cell Data Extraction:
   - Subject & Type: Suffixes indicate the class type. "-L" means Lecture/Theory (1 hr). "-T" means Tutorial (1 hr). "Lab" means Laboratory (2 hrs). The prefix before this is the subject code (e.g., ES, CN, PP).
   - Venue: Extract location codes (e.g., JCB-213, CVR-208).
   - Faculty: Extract instructor codes (e.g., VF-5).
5. Handling Split Cells (Batch/Group Partitions):
   - Some slots are split vertically into multiple subjects for different groups.
   - If a split block exists, ONLY extract the class that matches the user's specific batch: "${userBatch}".
   - If the user's batch is entirely missing from a split cell, treat it as FREE TIME and do not generate an event.
   - If user batch is not specified, or the cell is not split, assume it applies to the user.

Ensure the output is robust and perfectly formatted according to the schema. 
Time formats MUST be exactly "hh:mm AM/PM" (e.g., "08:00 AM", "05:00 PM").`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg',
            }
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: "List of extracted class sessions from the timetable",
            items: {
              type: Type.OBJECT,
              properties: {
                day: {
                  type: Type.STRING,
                  enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                  description: "Day of the week"
                },
                startTime: {
                  type: Type.STRING,
                  description: "Start time of the class in hh:mm AM/PM format, e.g. 08:00 AM"
                },
                endTime: {
                  type: Type.STRING,
                  description: "End time of the class in hh:mm AM/PM format, e.g. 08:55 AM"
                },
                subjectCode: {
                  type: Type.STRING,
                  description: "The core subject code (e.g., ES, CN, PP)"
                },
                type: {
                  type: Type.STRING,
                  enum: ['theory', 'lab', 'tutorial'],
                  description: "Class type derived from suffixes (-L = theory, -T = tutorial, Lab = lab)"
                },
                venue: {
                  type: Type.STRING,
                  description: "The venue code (e.g. JCB-213)",
                  nullable: true,
                },
                faculty: {
                  type: Type.STRING,
                  description: "The faculty code (e.g. VF-5)",
                  nullable: true,
                }
              },
              required: ["day", "startTime", "endTime", "subjectCode", "type"]
            }
          }
        }
      });

      if (!response.text) {
        throw new Error('AI returned an empty response.');
      }

      const parsedClasses: ParsedClassSession[] = JSON.parse(response.text);
      return parsedClasses;
    } catch (error) {
      console.error('Error parsing timetable with Gemini:', error);
      throw error;
    }
  }
}
