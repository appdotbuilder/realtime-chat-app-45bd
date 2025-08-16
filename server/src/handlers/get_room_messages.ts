import { db } from '../db';
import { messagesTable } from '../db/schema';
import { type GetRoomMessagesInput, type Message } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getRoomMessages = async (input: GetRoomMessagesInput): Promise<Message[]> => {
  try {
    // Build the query without joins to maintain type inference
    const limit = input.limit || 50;
    const offset = input.offset || 0;

    const results = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.room_id, input.room_id))
      .orderBy(desc(messagesTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    // Return results directly - they're already in the correct Message format
    return results;
  } catch (error) {
    console.error('Failed to get room messages:', error);
    throw error;
  }
};