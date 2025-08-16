import { db } from '../db';
import { commentsTable, uploadsTable, usersTable, pushNotificationsTable } from '../db/schema';
import { type CreateCommentInput, type Comment } from '../schema';
import { eq, and, ne } from 'drizzle-orm';

export const createComment = async (input: CreateCommentInput): Promise<Comment> => {
  try {
    // Validate that the upload exists and is accessible to the user
    const upload = await db.select()
      .from(uploadsTable)
      .where(eq(uploadsTable.id, input.upload_id))
      .limit(1)
      .execute();

    if (upload.length === 0) {
      throw new Error('Upload not found');
    }

    // Validate that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Create the comment
    const result = await db.insert(commentsTable)
      .values({
        upload_id: input.upload_id,
        user_id: input.user_id,
        content: input.content
      })
      .returning()
      .execute();

    const comment = result[0];

    // Get the upload owner to send notification
    const uploadOwner = upload[0];
    
    // Send notification to upload owner if they're not the commenter
    if (uploadOwner.user_id !== input.user_id) {
      await db.insert(pushNotificationsTable)
        .values({
          user_id: uploadOwner.user_id,
          title: 'New Comment',
          body: `Someone commented on your upload: ${uploadOwner.filename}`,
          type: 'new_comment',
          data: JSON.stringify({ 
            comment_id: comment.id, 
            upload_id: input.upload_id,
            commenter_id: input.user_id
          })
        })
        .execute();
    }

    // Get other commenters to notify them (excluding the current commenter and upload owner)
    const otherCommenters = await db.select({
      user_id: commentsTable.user_id
    })
      .from(commentsTable)
      .where(
        and(
          eq(commentsTable.upload_id, input.upload_id),
          ne(commentsTable.user_id, input.user_id),
          ne(commentsTable.user_id, uploadOwner.user_id)
        )
      )
      .execute();

    // Get unique user IDs
    const uniqueCommenters = [...new Set(otherCommenters.map(c => c.user_id))];

    // Send notifications to other commenters
    for (const commenterId of uniqueCommenters) {
      await db.insert(pushNotificationsTable)
        .values({
          user_id: commenterId,
          title: 'New Comment',
          body: `Someone else commented on an upload you commented on: ${uploadOwner.filename}`,
          type: 'new_comment',
          data: JSON.stringify({ 
            comment_id: comment.id, 
            upload_id: input.upload_id,
            commenter_id: input.user_id
          })
        })
        .execute();
    }

    return comment;
  } catch (error) {
    console.error('Comment creation failed:', error);
    throw error;
  }
};