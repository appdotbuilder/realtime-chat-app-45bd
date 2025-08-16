import { db } from '../db';
import { roomMembersTable, usersTable, chatRoomsTable, pushNotificationsTable } from '../db/schema';
import { type CreateRoomMemberInput, type RoomMember } from '../schema';
import { eq, and } from 'drizzle-orm';

export const addRoomMember = async (input: CreateRoomMemberInput): Promise<RoomMember> => {
  try {
    // Validate that the user exists
    const userExists = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .limit(1)
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with ID ${input.user_id} not found`);
    }

    // Validate that the room exists
    const roomExists = await db.select()
      .from(chatRoomsTable)
      .where(eq(chatRoomsTable.id, input.room_id))
      .limit(1)
      .execute();

    if (roomExists.length === 0) {
      throw new Error(`Chat room with ID ${input.room_id} not found`);
    }

    // Check if user is already a member of the room
    const existingMember = await db.select()
      .from(roomMembersTable)
      .where(
        and(
          eq(roomMembersTable.room_id, input.room_id),
          eq(roomMembersTable.user_id, input.user_id)
        )
      )
      .limit(1)
      .execute();

    if (existingMember.length > 0) {
      throw new Error(`User ${input.user_id} is already a member of room ${input.room_id}`);
    }

    // Insert room member record
    const result = await db.insert(roomMembersTable)
      .values({
        room_id: input.room_id,
        user_id: input.user_id,
        role: input.role || 'member'
      })
      .returning()
      .execute();

    const roomMember = result[0];

    // Send room_invite notification to the added user
    await db.insert(pushNotificationsTable)
      .values({
        user_id: input.user_id,
        title: 'Room Invitation',
        body: `You've been added to ${roomExists[0].name}`,
        type: 'room_invite',
        data: JSON.stringify({
          room_id: input.room_id,
          room_name: roomExists[0].name
        })
      })
      .execute();

    return roomMember;
  } catch (error) {
    console.error('Add room member failed:', error);
    throw error;
  }
};