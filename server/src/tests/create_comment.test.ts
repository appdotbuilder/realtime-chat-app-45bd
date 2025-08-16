import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, uploadsTable, commentsTable, pushNotificationsTable } from '../db/schema';
import { type CreateCommentInput } from '../schema';
import { createComment } from '../handlers/create_comment';
import { eq, and } from 'drizzle-orm';

// Test data
const testUser1 = {
  username: 'testuser1',
  email: 'test1@example.com',
  status: 'online' as const
};

const testUser2 = {
  username: 'testuser2', 
  email: 'test2@example.com',
  status: 'offline' as const
};

const testUser3 = {
  username: 'testuser3',
  email: 'test3@example.com', 
  status: 'away' as const
};

describe('createComment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a comment successfully', async () => {
    // Create test user and upload
    const [user] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const [upload] = await db.insert(uploadsTable)
      .values({
        user_id: user.id,
        filename: 'test.jpg',
        file_url: 'http://example.com/test.jpg',
        file_size: 1024,
        file_type: 'image/jpeg'
      })
      .returning()
      .execute();

    const input: CreateCommentInput = {
      upload_id: upload.id,
      user_id: user.id,
      content: 'Great upload!'
    };

    const result = await createComment(input);

    // Verify comment creation
    expect(result.upload_id).toEqual(upload.id);
    expect(result.user_id).toEqual(user.id);
    expect(result.content).toEqual('Great upload!');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save comment to database', async () => {
    // Create test user and upload
    const [user] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const [upload] = await db.insert(uploadsTable)
      .values({
        user_id: user.id,
        filename: 'test.jpg',
        file_url: 'http://example.com/test.jpg',
        file_size: 1024,
        file_type: 'image/jpeg'
      })
      .returning()
      .execute();

    const input: CreateCommentInput = {
      upload_id: upload.id,
      user_id: user.id,
      content: 'Amazing work!'
    };

    const result = await createComment(input);

    // Verify comment was saved
    const comments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, result.id))
      .execute();

    expect(comments).toHaveLength(1);
    expect(comments[0].content).toEqual('Amazing work!');
    expect(comments[0].upload_id).toEqual(upload.id);
    expect(comments[0].user_id).toEqual(user.id);
  });

  it('should send notification to upload owner when someone else comments', async () => {
    // Create upload owner and commenter
    const [uploadOwner] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const [commenter] = await db.insert(usersTable)
      .values(testUser2)
      .returning()
      .execute();

    const [upload] = await db.insert(uploadsTable)
      .values({
        user_id: uploadOwner.id,
        filename: 'awesome.png',
        file_url: 'http://example.com/awesome.png',
        file_size: 2048,
        file_type: 'image/png'
      })
      .returning()
      .execute();

    const input: CreateCommentInput = {
      upload_id: upload.id,
      user_id: commenter.id,
      content: 'Nice work!'
    };

    await createComment(input);

    // Check that notification was sent to upload owner
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.user_id, uploadOwner.id))
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toEqual('New Comment');
    expect(notifications[0].body).toEqual('Someone commented on your upload: awesome.png');
    expect(notifications[0].type).toEqual('new_comment');
    expect(notifications[0].is_read).toBe(false);

    const notificationData = JSON.parse(notifications[0].data || '{}');
    expect(notificationData.upload_id).toEqual(upload.id);
    expect(notificationData.commenter_id).toEqual(commenter.id);
  });

  it('should not send notification to upload owner when they comment on their own upload', async () => {
    // Create user who owns upload and comments
    const [user] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const [upload] = await db.insert(uploadsTable)
      .values({
        user_id: user.id,
        filename: 'myfile.pdf',
        file_url: 'http://example.com/myfile.pdf',
        file_size: 4096,
        file_type: 'application/pdf'
      })
      .returning()
      .execute();

    const input: CreateCommentInput = {
      upload_id: upload.id,
      user_id: user.id,
      content: 'Adding more info about this file'
    };

    await createComment(input);

    // Check that no notification was sent
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.user_id, user.id))
      .execute();

    expect(notifications).toHaveLength(0);
  });

  it('should notify other commenters when new comment is added', async () => {
    // Create upload owner, first commenter, and second commenter
    const [uploadOwner] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const [firstCommenter] = await db.insert(usersTable)
      .values(testUser2)
      .returning()
      .execute();

    const [secondCommenter] = await db.insert(usersTable)
      .values(testUser3)
      .returning()
      .execute();

    const [upload] = await db.insert(uploadsTable)
      .values({
        user_id: uploadOwner.id,
        filename: 'discussion.txt',
        file_url: 'http://example.com/discussion.txt',
        file_size: 512,
        file_type: 'text/plain'
      })
      .returning()
      .execute();

    // First commenter adds a comment
    await db.insert(commentsTable)
      .values({
        upload_id: upload.id,
        user_id: firstCommenter.id,
        content: 'First comment!'
      })
      .execute();

    // Second commenter adds a comment (this should notify first commenter and upload owner)
    const input: CreateCommentInput = {
      upload_id: upload.id,
      user_id: secondCommenter.id,
      content: 'Second comment!'
    };

    await createComment(input);

    // Check notifications to upload owner
    const ownerNotifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.user_id, uploadOwner.id))
      .execute();

    expect(ownerNotifications).toHaveLength(1);
    expect(ownerNotifications[0].type).toEqual('new_comment');

    // Check notifications to first commenter
    const commenterNotifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.user_id, firstCommenter.id))
      .execute();

    expect(commenterNotifications).toHaveLength(1);
    expect(commenterNotifications[0].title).toEqual('New Comment');
    expect(commenterNotifications[0].body).toContain('Someone else commented on an upload you commented on');
    expect(commenterNotifications[0].type).toEqual('new_comment');
  });

  it('should throw error when upload does not exist', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const input: CreateCommentInput = {
      upload_id: 99999, // Non-existent upload ID
      user_id: user.id,
      content: 'This should fail'
    };

    await expect(createComment(input)).rejects.toThrow(/upload not found/i);
  });

  it('should throw error when user does not exist', async () => {
    // Create upload owner
    const [uploadOwner] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const [upload] = await db.insert(uploadsTable)
      .values({
        user_id: uploadOwner.id,
        filename: 'test.jpg',
        file_url: 'http://example.com/test.jpg',
        file_size: 1024,
        file_type: 'image/jpeg'
      })
      .returning()
      .execute();

    const input: CreateCommentInput = {
      upload_id: upload.id,
      user_id: 99999, // Non-existent user ID
      content: 'This should fail'
    };

    await expect(createComment(input)).rejects.toThrow(/user not found/i);
  });

  it('should handle multiple comments from same user correctly', async () => {
    // Create upload owner and commenter
    const [uploadOwner] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const [commenter] = await db.insert(usersTable)
      .values(testUser2)
      .returning()
      .execute();

    const [upload] = await db.insert(uploadsTable)
      .values({
        user_id: uploadOwner.id,
        filename: 'multi.jpg',
        file_url: 'http://example.com/multi.jpg',
        file_size: 1024,
        file_type: 'image/jpeg'
      })
      .returning()
      .execute();

    // Add first comment
    await createComment({
      upload_id: upload.id,
      user_id: commenter.id,
      content: 'First comment'
    });

    // Clear notifications
    await db.delete(pushNotificationsTable).execute();

    // Add second comment from same user
    await createComment({
      upload_id: upload.id,
      user_id: commenter.id,
      content: 'Second comment'
    });

    // Should only notify upload owner once (not the commenter themselves)
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].user_id).toEqual(uploadOwner.id);
  });
});