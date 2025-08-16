import { db } from '../db';
import { pushNotificationsTable } from '../db/schema';
import { type MarkNotificationReadInput, type PushNotification } from '../schema';
import { eq } from 'drizzle-orm';

export const markNotificationRead = async (input: MarkNotificationReadInput): Promise<PushNotification> => {
  try {
    // Update the notification to mark it as read
    const result = await db.update(pushNotificationsTable)
      .set({
        is_read: true
      })
      .where(eq(pushNotificationsTable.id, input.id))
      .returning()
      .execute();

    // Check if notification was found and updated
    if (result.length === 0) {
      throw new Error(`Notification with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
};