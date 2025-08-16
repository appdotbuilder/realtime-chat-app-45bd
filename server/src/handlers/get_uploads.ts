import { z } from 'zod';
import { db } from '../db';
import { uploadsTable, usersTable, commentsTable } from '../db/schema';
import { eq, count, and, type SQL, inArray } from 'drizzle-orm';

// Input schema for get uploads
export const getUploadsInputSchema = z.object({
  room_id: z.number().optional(),
  user_id: z.number().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0)
});

export type GetUploadsInput = z.infer<typeof getUploadsInputSchema>;

// Extended upload type with user info and comment count
export interface UploadWithDetails {
  id: number;
  user_id: number;
  filename: string;
  file_url: string;
  file_size: number;
  file_type: string;
  room_id: number | null;
  created_at: Date;
  user: {
    id: number;
    username: string;
    email: string;
    avatar_url: string | null;
  };
  comment_count: number;
}

export const getUploads = async (input: Partial<GetUploadsInput> = {}): Promise<UploadWithDetails[]> => {
  try {
    // Parse and apply defaults
    const parsedInput = getUploadsInputSchema.parse(input);
    // Build base query with user join
    let baseQuery = db.select({
      id: uploadsTable.id,
      user_id: uploadsTable.user_id,
      filename: uploadsTable.filename,
      file_url: uploadsTable.file_url,
      file_size: uploadsTable.file_size,
      file_type: uploadsTable.file_type,
      room_id: uploadsTable.room_id,
      created_at: uploadsTable.created_at,
      user: {
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        avatar_url: usersTable.avatar_url
      }
    })
    .from(uploadsTable)
    .innerJoin(usersTable, eq(uploadsTable.user_id, usersTable.id));

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (parsedInput.room_id !== undefined) {
      conditions.push(eq(uploadsTable.room_id, parsedInput.room_id));
    }

    if (parsedInput.user_id !== undefined) {
      conditions.push(eq(uploadsTable.user_id, parsedInput.user_id));
    }

    // Apply where clause if conditions exist
    let queryWithConditions = conditions.length > 0 
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    // Apply pagination
    const finalQuery = queryWithConditions.limit(parsedInput.limit).offset(parsedInput.offset);

    const results = await finalQuery.execute();

    // Get comment counts for all uploads
    const uploadIds = results.map(result => result.id);
    
    let commentCounts: { upload_id: number; count: number }[] = [];
    if (uploadIds.length > 0) {
      // Build comment count query in one go to avoid type issues
      const rawCounts = uploadIds.length === 1
        ? await db.select({
            upload_id: commentsTable.upload_id,
            count: count().as('count')
          })
          .from(commentsTable)
          .where(eq(commentsTable.upload_id, uploadIds[0]))
          .groupBy(commentsTable.upload_id)
          .execute()
        : await db.select({
            upload_id: commentsTable.upload_id,
            count: count().as('count')
          })
          .from(commentsTable)
          .where(inArray(commentsTable.upload_id, uploadIds))
          .groupBy(commentsTable.upload_id)
          .execute();
      
      // Convert string counts to numbers
      commentCounts = rawCounts.map(item => ({
        upload_id: item.upload_id,
        count: typeof item.count === 'string' ? parseInt(item.count) : item.count
      }));
    }

    // Create a map for quick lookup of comment counts
    const commentCountMap = new Map<number, number>();
    commentCounts.forEach(item => {
      commentCountMap.set(item.upload_id, item.count);
    });

    // Combine results with comment counts
    return results.map(result => ({
      id: result.id,
      user_id: result.user_id,
      filename: result.filename,
      file_url: result.file_url,
      file_size: result.file_size,
      file_type: result.file_type,
      room_id: result.room_id,
      created_at: result.created_at,
      user: result.user,
      comment_count: commentCountMap.get(result.id) || 0
    }));
  } catch (error) {
    console.error('Get uploads failed:', error);
    throw error;
  }
};