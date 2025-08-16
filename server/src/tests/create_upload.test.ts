import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { uploadsTable, usersTable, chatRoomsTable, roomMembersTable, pushNotificationsTable } from '../db/schema';
import { type CreateUploadInput } from '../schema';
import { createUpload } from '../handlers/create_upload';
import { eq, and } from 'drizzle-orm';

describe('createUpload', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create a test user
  const createTestUser = async (username = 'testuser', email = 'test@example.com') => {
    const users = await db.insert(usersTable)
      .values({
        username,
        email,
        status: 'online'
      })
      .returning()
      .execute();
    return users[0];
  };

  // Helper to create a test room
  const createTestRoom = async (createdBy: number, name = 'Test Room') => {
    const rooms = await db.insert(chatRoomsTable)
      .values({
        name,
        description: 'Test room description',
        is_private: false,
        created_by: createdBy
      })
      .returning()
      .execute();
    return rooms[0];
  };

  // Helper to add user to room
  const addUserToRoom = async (userId: number, roomId: number, role: 'admin' | 'moderator' | 'member' = 'member') => {
    await db.insert(roomMembersTable)
      .values({
        room_id: roomId,
        user_id: userId,
        role
      })
      .execute();
  };

  it('should create upload without room', async () => {
    const user = await createTestUser();

    const testInput: CreateUploadInput = {
      user_id: user.id,
      filename: 'test-file.pdf',
      file_url: 'https://example.com/files/test-file.pdf',
      file_size: 1024000,
      file_type: 'application/pdf',
      room_id: null
    };

    const result = await createUpload(testInput);

    // Verify upload properties
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(user.id);
    expect(result.filename).toEqual('test-file.pdf');
    expect(result.file_url).toEqual(testInput.file_url);
    expect(result.file_size).toEqual(1024000);
    expect(result.file_type).toEqual('application/pdf');
    expect(result.room_id).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create upload with room', async () => {
    const user = await createTestUser();
    const room = await createTestRoom(user.id);
    await addUserToRoom(user.id, room.id, 'admin');

    const testInput: CreateUploadInput = {
      user_id: user.id,
      filename: 'room-file.jpg',
      file_url: 'https://example.com/files/room-file.jpg',
      file_size: 2048000,
      file_type: 'image/jpeg',
      room_id: room.id
    };

    const result = await createUpload(testInput);

    expect(result.room_id).toEqual(room.id);
    expect(result.filename).toEqual('room-file.jpg');
    expect(result.file_type).toEqual('image/jpeg');
    expect(result.file_size).toEqual(2048000);
  });

  it('should save upload to database', async () => {
    const user = await createTestUser();

    const testInput: CreateUploadInput = {
      user_id: user.id,
      filename: 'database-test.txt',
      file_url: 'https://example.com/files/database-test.txt',
      file_size: 512,
      file_type: 'text/plain'
    };

    const result = await createUpload(testInput);

    // Verify in database
    const uploads = await db.select()
      .from(uploadsTable)
      .where(eq(uploadsTable.id, result.id))
      .execute();

    expect(uploads).toHaveLength(1);
    expect(uploads[0].filename).toEqual('database-test.txt');
    expect(uploads[0].file_size).toEqual(512);
    expect(uploads[0].user_id).toEqual(user.id);
    expect(uploads[0].created_at).toBeInstanceOf(Date);
  });

  it('should create notifications for room members when uploading to room', async () => {
    // Create users
    const uploader = await createTestUser('uploader', 'uploader@example.com');
    const member1 = await createTestUser('member1', 'member1@example.com');
    const member2 = await createTestUser('member2', 'member2@example.com');

    // Create room and add members
    const room = await createTestRoom(uploader.id);
    await addUserToRoom(uploader.id, room.id, 'admin');
    await addUserToRoom(member1.id, room.id, 'member');
    await addUserToRoom(member2.id, room.id, 'member');

    const testInput: CreateUploadInput = {
      user_id: uploader.id,
      filename: 'shared-file.docx',
      file_url: 'https://example.com/files/shared-file.docx',
      file_size: 3072000,
      file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      room_id: room.id
    };

    await createUpload(testInput);

    // Check notifications were created for room members (excluding uploader)
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.type, 'new_upload'))
      .execute();

    expect(notifications).toHaveLength(2);
    
    // Verify notification content
    const notification = notifications[0];
    expect(notification.title).toEqual('New File Upload');
    expect(notification.body).toContain('uploader uploaded shared-file.docx');
    expect(notification.type).toEqual('new_upload');
    expect(notification.is_read).toBe(false);

    // Verify notification data
    const notificationData = JSON.parse(notification.data!);
    expect(notificationData.filename).toEqual('shared-file.docx');
    expect(notificationData.room_id).toEqual(room.id);
    expect(notificationData.upload_id).toBeDefined();

    // Verify notifications went to correct users
    const notifiedUserIds = notifications.map(n => n.user_id).sort();
    expect(notifiedUserIds).toEqual([member1.id, member2.id].sort());
  });

  it('should not create notifications when uploading without room', async () => {
    const user = await createTestUser();

    const testInput: CreateUploadInput = {
      user_id: user.id,
      filename: 'private-file.txt',
      file_url: 'https://example.com/files/private-file.txt',
      file_size: 256,
      file_type: 'text/plain'
    };

    await createUpload(testInput);

    // Check no notifications were created
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .execute();

    expect(notifications).toHaveLength(0);
  });

  it('should throw error when user does not exist', async () => {
    const testInput: CreateUploadInput = {
      user_id: 999999,
      filename: 'test.txt',
      file_url: 'https://example.com/files/test.txt',
      file_size: 1024,
      file_type: 'text/plain'
    };

    await expect(createUpload(testInput)).rejects.toThrow(/User with id 999999 does not exist/i);
  });

  it('should throw error when room does not exist', async () => {
    const user = await createTestUser();

    const testInput: CreateUploadInput = {
      user_id: user.id,
      filename: 'test.txt',
      file_url: 'https://example.com/files/test.txt',
      file_size: 1024,
      file_type: 'text/plain',
      room_id: 999999
    };

    await expect(createUpload(testInput)).rejects.toThrow(/Chat room with id 999999 does not exist/i);
  });

  it('should throw error when user is not member of room', async () => {
    const uploader = await createTestUser('uploader', 'uploader@example.com');
    const roomOwner = await createTestUser('owner', 'owner@example.com');
    
    const room = await createTestRoom(roomOwner.id);
    await addUserToRoom(roomOwner.id, room.id, 'admin');

    const testInput: CreateUploadInput = {
      user_id: uploader.id,
      filename: 'unauthorized.txt',
      file_url: 'https://example.com/files/unauthorized.txt',
      file_size: 1024,
      file_type: 'text/plain',
      room_id: room.id
    };

    await expect(createUpload(testInput)).rejects.toThrow(/User is not a member of room/i);
  });

  it('should handle different file types correctly', async () => {
    const user = await createTestUser();

    const fileTypes = [
      { filename: 'image.png', type: 'image/png', size: 512000 },
      { filename: 'video.mp4', type: 'video/mp4', size: 10240000 },
      { filename: 'document.pdf', type: 'application/pdf', size: 2048000 },
      { filename: 'archive.zip', type: 'application/zip', size: 5120000 }
    ];

    for (const file of fileTypes) {
      const testInput: CreateUploadInput = {
        user_id: user.id,
        filename: file.filename,
        file_url: `https://example.com/files/${file.filename}`,
        file_size: file.size,
        file_type: file.type
      };

      const result = await createUpload(testInput);
      
      expect(result.filename).toEqual(file.filename);
      expect(result.file_type).toEqual(file.type);
      expect(result.file_size).toEqual(file.size);
    }

    // Verify all uploads were saved
    const uploads = await db.select()
      .from(uploadsTable)
      .where(eq(uploadsTable.user_id, user.id))
      .execute();

    expect(uploads).toHaveLength(fileTypes.length);
  });
});