import { type GetUserRoomsInput, type ChatRoom } from '../schema';

export const getUserRooms = async (input: GetUserRoomsInput): Promise<ChatRoom[]> => {
  // This is a placeholder declaration! Real code should be implemented here.
  // The goal of this handler is fetching all chat rooms where the user is a member.
  // Should join with room_members table to get only rooms the user belongs to.
  return [];
};