import { db } from '../db';
import { chatRoomsTable, roomMembersTable } from '../db/schema';
import { type GetUserRoomsInput, type ChatRoom } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserRooms = async (input: GetUserRoomsInput): Promise<ChatRoom[]> => {
  try {
    // Join chat rooms with room members to get only rooms the user belongs to
    const results = await db.select({
      id: chatRoomsTable.id,
      name: chatRoomsTable.name,
      description: chatRoomsTable.description,
      is_private: chatRoomsTable.is_private,
      created_by: chatRoomsTable.created_by,
      created_at: chatRoomsTable.created_at,
      updated_at: chatRoomsTable.updated_at
    })
    .from(chatRoomsTable)
    .innerJoin(roomMembersTable, eq(chatRoomsTable.id, roomMembersTable.room_id))
    .where(eq(roomMembersTable.user_id, input.user_id))
    .execute();

    return results;
  } catch (error) {
    console.error('Get user rooms failed:', error);
    throw error;
  }
};