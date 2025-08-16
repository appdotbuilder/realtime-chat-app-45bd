import { db } from '../db';
import { pushNotificationsTable } from '../db/schema';
import { type CreatePushNotificationInput, type PushNotification } from '../schema';

export const createPushNotification = async (input: CreatePushNotificationInput): Promise<PushNotification> => {
  try {
    // Insert notification record
    const result = await db.insert(pushNotificationsTable)
      .values({
        user_id: input.user_id,
        title: input.title,
        body: input.body,
        type: input.type,
        data: input.data || null, // Handle optional data field
        is_read: false // Default to unread
      })
      .returning()
      .execute();

    const notification = result[0];
    return notification;
  } catch (error) {
    console.error('Push notification creation failed:', error);
    throw error;
  }
};