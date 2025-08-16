import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, uploadsTable, commentsTable } from '../db/schema';
import { getUploadComments } from '../handlers/get_upload_comments';

// Test data
const testUser1 = {
  username: 'testuser1',
  email: 'user1@example.com',
  avatar_url: null,
  status: 'online' as const
};

const testUser2 = {
  username: 'testuser2',
  email: 'user2@example.com',
  avatar_url: 'https://example.com/avatar2.jpg',
  status: 'offline' as const
};

const testUpload = {
  user_id: 1,
  filename: 'test-file.jpg',
  file_url: 'https://example.com/test-file.jpg',
  file_size: 1024,
  file_type: 'image/jpeg',
  room_id: null
};

describe('getUploadComments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when upload has no comments', async () => {
    // Create user and upload
    const users = await db.insert(usersTable).values(testUser1).returning().execute();
    const uploads = await db.insert(uploadsTable).values({
      ...testUpload,
      user_id: users[0].id
    }).returning().execute();

    const result = await getUploadComments(uploads[0].id);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return comments for an upload with user information', async () => {
    // Create users
    const users = await db.insert(usersTable).values([testUser1, testUser2]).returning().execute();
    
    // Create upload
    const uploads = await db.insert(uploadsTable).values({
      ...testUpload,
      user_id: users[0].id
    }).returning().execute();

    // Create comments
    const commentData = [
      {
        upload_id: uploads[0].id,
        user_id: users[0].id,
        content: 'First comment'
      },
      {
        upload_id: uploads[0].id,
        user_id: users[1].id,
        content: 'Second comment'
      }
    ];

    await db.insert(commentsTable).values(commentData).execute();

    const result = await getUploadComments(uploads[0].id);

    expect(result).toHaveLength(2);
    
    // Check first comment
    expect(result[0].content).toEqual('First comment');
    expect(result[0].user_id).toEqual(users[0].id);
    expect(result[0].upload_id).toEqual(uploads[0].id);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    // Check second comment
    expect(result[1].content).toEqual('Second comment');
    expect(result[1].user_id).toEqual(users[1].id);
    expect(result[1].upload_id).toEqual(uploads[0].id);
  });

  it('should return comments ordered by created_at ascending', async () => {
    // Create user
    const users = await db.insert(usersTable).values(testUser1).returning().execute();
    
    // Create upload
    const uploads = await db.insert(uploadsTable).values({
      ...testUpload,
      user_id: users[0].id
    }).returning().execute();

    // Create comments with specific timing
    const firstComment = await db.insert(commentsTable).values({
      upload_id: uploads[0].id,
      user_id: users[0].id,
      content: 'Oldest comment'
    }).returning().execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondComment = await db.insert(commentsTable).values({
      upload_id: uploads[0].id,
      user_id: users[0].id,
      content: 'Newer comment'
    }).returning().execute();

    const result = await getUploadComments(uploads[0].id);

    expect(result).toHaveLength(2);
    
    // Should be ordered by created_at ascending (oldest first)
    expect(result[0].content).toEqual('Oldest comment');
    expect(result[1].content).toEqual('Newer comment');
    
    // Verify timestamps are in ascending order
    expect(result[0].created_at <= result[1].created_at).toBe(true);
  });

  it('should only return comments for the specified upload', async () => {
    // Create user
    const users = await db.insert(usersTable).values(testUser1).returning().execute();
    
    // Create two uploads
    const uploads = await db.insert(uploadsTable).values([
      {
        ...testUpload,
        user_id: users[0].id,
        filename: 'upload1.jpg'
      },
      {
        ...testUpload,
        user_id: users[0].id,
        filename: 'upload2.jpg'
      }
    ]).returning().execute();

    // Create comments for both uploads
    await db.insert(commentsTable).values([
      {
        upload_id: uploads[0].id,
        user_id: users[0].id,
        content: 'Comment for upload 1'
      },
      {
        upload_id: uploads[1].id,
        user_id: users[0].id,
        content: 'Comment for upload 2'
      }
    ]).execute();

    // Get comments for first upload only
    const result = await getUploadComments(uploads[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual('Comment for upload 1');
    expect(result[0].upload_id).toEqual(uploads[0].id);
  });

  it('should return empty array for non-existent upload', async () => {
    const result = await getUploadComments(999);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should handle multiple comments from same user', async () => {
    // Create user
    const users = await db.insert(usersTable).values(testUser1).returning().execute();
    
    // Create upload
    const uploads = await db.insert(uploadsTable).values({
      ...testUpload,
      user_id: users[0].id
    }).returning().execute();

    // Create multiple comments from same user, ensuring proper order with separate inserts
    const firstComment = await db.insert(commentsTable).values({
      upload_id: uploads[0].id,
      user_id: users[0].id,
      content: 'First comment from user'
    }).returning().execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondComment = await db.insert(commentsTable).values({
      upload_id: uploads[0].id,
      user_id: users[0].id,
      content: 'Second comment from same user'
    }).returning().execute();

    const result = await getUploadComments(uploads[0].id);

    expect(result).toHaveLength(2);
    expect(result[0].user_id).toEqual(users[0].id);
    expect(result[1].user_id).toEqual(users[0].id);
    expect(result[0].content).toEqual('First comment from user');
    expect(result[1].content).toEqual('Second comment from same user');
    
    // Verify timestamps are in ascending order
    expect(result[0].created_at <= result[1].created_at).toBe(true);
  });
});