import { db } from '../../core/db/client';
import { aiConnections, tutorConversations, tutorMessages } from './model';
import { eq, desc, asc } from 'drizzle-orm';
import * as crypto from 'expo-crypto';

export class AIRepository {
  static async getActiveConnection() {
    const conns = await db.select().from(aiConnections).where(eq(aiConnections.pairingState, 'paired')).orderBy(desc(aiConnections.createdAt)).limit(1);
    return conns[0];
  }

  static async getOrCreateConversation(connectionId: string) {
    let convs = await db.select().from(tutorConversations).where(eq(tutorConversations.connectionId, connectionId)).orderBy(desc(tutorConversations.createdAt)).limit(1);
    
    if (convs.length > 0) {
      return convs[0];
    }

    const newId = crypto.randomUUID();
    await db.insert(tutorConversations).values({
      id: newId,
      connectionId,
      title: 'Tutor Chat'
    });
    
    convs = await db.select().from(tutorConversations).where(eq(tutorConversations.id, newId));
    return convs[0];
  }

  static async getMessages(conversationId: string) {
    return await db.select().from(tutorMessages).where(eq(tutorMessages.conversationId, conversationId)).orderBy(asc(tutorMessages.createdAt));
  }

  static async saveMessage(conversationId: string, role: string, body: string, sourceManifest: string | null = null) {
    const id = crypto.randomUUID();
    await db.insert(tutorMessages).values({
      id,
      conversationId,
      role,
      body,
      sourceManifest
    });
    return { id, conversationId, role, body, sourceManifest };
  }
}
