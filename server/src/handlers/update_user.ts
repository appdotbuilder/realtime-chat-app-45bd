import { db } from '../db';
import { usersTable, pushNotificationsTable, roomMembersTable } from '../db/schema';
import { type UpdateUserInput, type User } from '../schema';
import { eq, and, ne, sql } from 'drizzle-orm';

export const updateUser = async (input: UpdateUserInput): Promise<User> => {
  try {
    // First, get the current user data to check if status changed
    const currentUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.id))
      .execute();

    if (currentUser.length === 0) {
      throw new Error('User not found');
    }

    const oldStatus = currentUser[0].status;

    // Build the update data - only include fields that are provided
    const updateData: Partial<typeof usersTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.username !== undefined) {
      updateData.username = input.username;
    }
    if (input.email !== undefined) {
      updateData.email = input.email;
    }
    if (input.avatar_url !== undefined) {
      updateData.avatar_url = input.avatar_url;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    // Update the user
    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User update failed');
    }

    const updatedUser = result[0];

    // If status changed, send notifications to other users in the same rooms
    if (input.status !== undefined && input.status !== oldStatus) {
      // Find all users who share rooms with this user (deduplicated)
      const roomMatesQuery = await db.selectDistinct({
        user_id: roomMembersTable.user_id,
        username: usersTable.username
      })
        .from(roomMembersTable)
        .innerJoin(usersTable, eq(roomMembersTable.user_id, usersTable.id))
        .where(
          and(
            // Users in rooms where the updated user is also a member
            sql`${roomMembersTable.room_id} IN (
              SELECT room_id FROM ${roomMembersTable} 
              WHERE user_id = ${input.id}
            )`,
            // But exclude the user who was updated
            ne(roomMembersTable.user_id, input.id)
          )
        )
        .execute();

      // Create status update notifications for each room mate
      if (roomMatesQuery.length > 0) {
        const notifications = roomMatesQuery.map(roomMate => ({
          user_id: roomMate.user_id,
          title: 'User Status Update',
          body: `${updatedUser.username} is now ${updatedUser.status}`,
          type: 'status_update' as const,
          data: JSON.stringify({
            user_id: updatedUser.id,
            username: updatedUser.username,
            old_status: oldStatus,
            new_status: updatedUser.status
          }),
          is_read: false
        }));

        // Insert notifications
        await db.insert(pushNotificationsTable)
          .values(notifications)
          .execute();
      }
    }

    return updatedUser;
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
};