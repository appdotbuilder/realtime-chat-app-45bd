import { db } from '../db';
import { messagesTable, roomMembersTable, pushNotificationsTable } from '../db/schema';
import { type CreateMessageInput, type Message } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createMessage = async (input: CreateMessageInput): Promise<Message> => {
  try {
    // First, validate that the user is a member of the room
    const membership = await db.select()
      .from(roomMembersTable)
      .where(
        and(
          eq(roomMembersTable.room_id, input.room_id),
          eq(roomMembersTable.user_id, input.user_id)
        )
      )
      .execute();

    if (membership.length === 0) {
      throw new Error('User is not a member of this room');
    }

    // If reply_to_id is provided, validate that the message exists in the same room
    if (input.reply_to_id) {
      const replyMessage = await db.select()
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.id, input.reply_to_id),
            eq(messagesTable.room_id, input.room_id)
          )
        )
        .execute();

      if (replyMessage.length === 0) {
        throw new Error('Reply target message not found in this room');
      }
    }

    // Insert the message
    const result = await db.insert(messagesTable)
      .values({
        room_id: input.room_id,
        user_id: input.user_id,
        content: input.content,
        message_type: input.message_type || 'text',
        file_url: input.file_url || null,
        reply_to_id: input.reply_to_id || null
      })
      .returning()
      .execute();

    const message = result[0];

    // Create notifications for all other room members
    const roomMembers = await db.select()
      .from(roomMembersTable)
      .where(eq(roomMembersTable.room_id, input.room_id))
      .execute();

    // Filter out the message sender and create notifications for other members
    const otherMembers = roomMembers.filter(member => member.user_id !== input.user_id);
    
    if (otherMembers.length > 0) {
      const notificationValues = otherMembers.map(member => ({
        user_id: member.user_id,
        title: 'New Message',
        body: `New message in room: ${input.content.substring(0, 50)}${input.content.length > 50 ? '...' : ''}`,
        type: 'new_message' as const,
        data: JSON.stringify({ 
          room_id: input.room_id, 
          message_id: message.id,
          sender_id: input.user_id
        })
      }));

      await db.insert(pushNotificationsTable)
        .values(notificationValues)
        .execute();
    }

    return message;
  } catch (error) {
    console.error('Message creation failed:', error);
    throw error;
  }
};