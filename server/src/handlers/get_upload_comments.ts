import { db } from '../db';
import { commentsTable, usersTable } from '../db/schema';
import { type Comment } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getUploadComments = async (uploadId: number): Promise<Comment[]> => {
  try {
    // Fetch comments with user information, ordered by created_at ascending
    const results = await db.select({
      id: commentsTable.id,
      upload_id: commentsTable.upload_id,
      user_id: commentsTable.user_id,
      content: commentsTable.content,
      created_at: commentsTable.created_at,
      updated_at: commentsTable.updated_at,
      // Include user information
      username: usersTable.username,
      user_email: usersTable.email,
      user_avatar_url: usersTable.avatar_url
    })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.user_id, usersTable.id))
    .where(eq(commentsTable.upload_id, uploadId))
    .orderBy(asc(commentsTable.created_at))
    .execute();

    // Map results to Comment schema format
    return results.map(result => ({
      id: result.id,
      upload_id: result.upload_id,
      user_id: result.user_id,
      content: result.content,
      created_at: result.created_at,
      updated_at: result.updated_at
    }));
  } catch (error) {
    console.error('Failed to fetch upload comments:', error);
    throw error;
  }
};