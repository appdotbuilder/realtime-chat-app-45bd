import { db } from '../db';
import { uploadsTable, usersTable, chatRoomsTable, roomMembersTable, pushNotificationsTable } from '../db/schema';
import { type CreateUploadInput, type Upload } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createUpload = async (input: CreateUploadInput): Promise<Upload> => {
  try {
    // Verify user exists
    const userExists = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with id ${input.user_id} does not exist`);
    }

    // If room_id is provided, verify room exists and user is a member
    if (input.room_id) {
      const roomExists = await db.select()
        .from(chatRoomsTable)
        .where(eq(chatRoomsTable.id, input.room_id))
        .execute();

      if (roomExists.length === 0) {
        throw new Error(`Chat room with id ${input.room_id} does not exist`);
      }

      // Check if user is a member of the room
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
        throw new Error(`User is not a member of room ${input.room_id}`);
      }
    }

    // Insert upload record
    const result = await db.insert(uploadsTable)
      .values({
        user_id: input.user_id,
        filename: input.filename,
        file_url: input.file_url,
        file_size: input.file_size,
        file_type: input.file_type,
        room_id: input.room_id || null
      })
      .returning()
      .execute();

    const upload = result[0];

    // Send notifications to relevant users if upload is in a room
    if (input.room_id) {
      // Get all room members except the uploader
      const roomMembers = await db.select()
        .from(roomMembersTable)
        .where(
          and(
            eq(roomMembersTable.room_id, input.room_id),
            eq(usersTable.id, roomMembersTable.user_id)
          )
        )
        .innerJoin(usersTable, eq(roomMembersTable.user_id, usersTable.id))
        .execute();

      // Create notifications for all room members except the uploader
      const notifications = roomMembers
        .filter(member => member.room_members.user_id !== input.user_id)
        .map(member => ({
          user_id: member.room_members.user_id,
          title: 'New File Upload',
          body: `${userExists[0].username} uploaded ${input.filename}`,
          type: 'new_upload' as const,
          data: JSON.stringify({ 
            upload_id: upload.id, 
            room_id: input.room_id,
            filename: input.filename 
          })
        }));

      if (notifications.length > 0) {
        await db.insert(pushNotificationsTable)
          .values(notifications)
          .execute();
      }
    }

    return upload;
  } catch (error) {
    console.error('Upload creation failed:', error);
    throw error;
  }
};