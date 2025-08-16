import { type MarkNotificationReadInput, type PushNotification } from '../schema';

export const markNotificationRead = async (input: MarkNotificationReadInput): Promise<PushNotification> => {
  // This is a placeholder declaration! Real code should be implemented here.
  // The goal of this handler is marking a notification as read.
  // Should validate that the notification belongs to the requesting user.
  // Should update the is_read field to true.
  return Promise.resolve({
    id: input.id,
    user_id: 0, // Placeholder
    title: 'Placeholder title',
    body: 'Placeholder body',
    type: 'new_message',
    data: null,
    is_read: true,
    created_at: new Date()
  } as PushNotification);
};