import { db } from '../db';
import { chatRoomsTable, roomMembersTable } from '../db/schema';
import { type CreateChatRoomInput, type ChatRoom } from '../schema';

export const createChatRoom = async (input: CreateChatRoomInput): Promise<ChatRoom> => {
  try {
    // Create chat room within a transaction
    const result = await db.transaction(async (tx) => {
      // Insert chat room record
      const chatRoomResult = await tx.insert(chatRoomsTable)
        .values({
          name: input.name,
          description: input.description || null,
          is_private: input.is_private || false,
          created_by: input.created_by
        })
        .returning()
        .execute();

      const chatRoom = chatRoomResult[0];

      // Automatically add the creator as an admin member
      await tx.insert(roomMembersTable)
        .values({
          room_id: chatRoom.id,
          user_id: input.created_by,
          role: 'admin'
        })
        .execute();

      return chatRoom;
    });

    return result;
  } catch (error) {
    console.error('Chat room creation failed:', error);
    throw error;
  }
};