import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Insert user record with defaults applied
    const result = await db.insert(usersTable)
      .values({
        username: input.username,
        email: input.email,
        avatar_url: input.avatar_url || null,
        status: input.status || 'offline'
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};