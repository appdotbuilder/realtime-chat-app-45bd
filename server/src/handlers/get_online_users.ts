import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type User } from '../schema';

export const getOnlineUsers = async (): Promise<User[]> => {
  try {
    // Query users with 'online' status
    const results = await db.select()
      .from(usersTable)
      .where(eq(usersTable.status, 'online'))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch online users:', error);
    throw error;
  }
};