import { db } from '../db';
import { pushNotificationsTable } from '../db/schema';
import { type GetUserNotificationsInput, type PushNotification } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getUserNotifications = async (input: GetUserNotificationsInput): Promise<PushNotification[]> => {
  try {
    // Apply pagination defaults
    const limit = input.limit || 20;
    const offset = input.offset || 0;
    
    // Build complete query in one chain to maintain type inference
    const results = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.user_id, input.user_id))
      .orderBy(desc(pushNotificationsTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    return results;
  } catch (error) {
    console.error('Get user notifications failed:', error);
    throw error;
  }
};