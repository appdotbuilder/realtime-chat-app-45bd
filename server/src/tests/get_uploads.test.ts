import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatRoomsTable, uploadsTable, commentsTable } from '../db/schema';
import { getUploads, type GetUploadsInput, getUploadsInputSchema } from '../handlers/get_uploads';

describe('getUploads', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get all uploads with user info and comment counts', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    // Create test room
    const [room] = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        created_by: user.id
      })
      .returning()
      .execute();

    // Create test upload
    const [upload] = await db.insert(uploadsTable)
      .values({
        user_id: user.id,
        filename: 'test.jpg',
        file_url: 'https://example.com/test.jpg',
        file_size: 1024,
        file_type: 'image/jpeg',
        room_id: room.id
      })
      .returning()
      .execute();

    // Create test comments
    await db.insert(commentsTable)
      .values([
        {
          upload_id: upload.id,
          user_id: user.id,
          content: 'Nice upload!'
        },
        {
          upload_id: upload.id,
          user_id: user.id,
          content: 'Great file!'
        }
      ])
      .execute();

    const input = getUploadsInputSchema.parse({});

    const result = await getUploads(input);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(upload.id);
    expect(result[0].filename).toEqual('test.jpg');
    expect(result[0].file_url).toEqual('https://example.com/test.jpg');
    expect(result[0].file_size).toEqual(1024);
    expect(result[0].file_type).toEqual('image/jpeg');
    expect(result[0].room_id).toEqual(room.id);
    expect(result[0].user_id).toEqual(user.id);
    expect(result[0].created_at).toBeInstanceOf(Date);
    
    // Check user info
    expect(result[0].user.id).toEqual(user.id);
    expect(result[0].user.username).toEqual('testuser');
    expect(result[0].user.email).toEqual('test@example.com');
    expect(result[0].user.avatar_url).toBeNull();
    
    // Check comment count
    expect(result[0].comment_count).toEqual(2);
  });

  it('should filter uploads by room_id', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    // Create two test rooms
    const [room1, room2] = await db.insert(chatRoomsTable)
      .values([
        {
          name: 'Test Room 1',
          created_by: user.id
        },
        {
          name: 'Test Room 2',
          created_by: user.id
        }
      ])
      .returning()
      .execute();

    // Create uploads in different rooms
    await db.insert(uploadsTable)
      .values([
        {
          user_id: user.id,
          filename: 'room1-file.jpg',
          file_url: 'https://example.com/room1.jpg',
          file_size: 1024,
          file_type: 'image/jpeg',
          room_id: room1.id
        },
        {
          user_id: user.id,
          filename: 'room2-file.jpg',
          file_url: 'https://example.com/room2.jpg',
          file_size: 2048,
          file_type: 'image/jpeg',
          room_id: room2.id
        },
        {
          user_id: user.id,
          filename: 'no-room-file.jpg',
          file_url: 'https://example.com/noroom.jpg',
          file_size: 512,
          file_type: 'image/jpeg',
          room_id: null
        }
      ])
      .execute();

    const input = getUploadsInputSchema.parse({
      room_id: room1.id
    });

    const result = await getUploads(input);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toEqual('room1-file.jpg');
    expect(result[0].room_id).toEqual(room1.id);
    expect(result[0].comment_count).toEqual(0);
  });

  it('should filter uploads by user_id', async () => {
    // Create test users
    const [user1, user2] = await db.insert(usersTable)
      .values([
        {
          username: 'testuser1',
          email: 'test1@example.com',
          status: 'online'
        },
        {
          username: 'testuser2',
          email: 'test2@example.com',
          status: 'offline'
        }
      ])
      .returning()
      .execute();

    // Create test room
    const [room] = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        created_by: user1.id
      })
      .returning()
      .execute();

    // Create uploads by different users
    await db.insert(uploadsTable)
      .values([
        {
          user_id: user1.id,
          filename: 'user1-file.jpg',
          file_url: 'https://example.com/user1.jpg',
          file_size: 1024,
          file_type: 'image/jpeg',
          room_id: room.id
        },
        {
          user_id: user2.id,
          filename: 'user2-file.jpg',
          file_url: 'https://example.com/user2.jpg',
          file_size: 2048,
          file_type: 'image/jpeg',
          room_id: room.id
        }
      ])
      .execute();

    const input = getUploadsInputSchema.parse({
      user_id: user2.id
    });

    const result = await getUploads(input);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toEqual('user2-file.jpg');
    expect(result[0].user_id).toEqual(user2.id);
    expect(result[0].user.username).toEqual('testuser2');
    expect(result[0].user.email).toEqual('test2@example.com');
  });

  it('should filter by both room_id and user_id', async () => {
    // Create test users
    const [user1, user2] = await db.insert(usersTable)
      .values([
        {
          username: 'testuser1',
          email: 'test1@example.com',
          status: 'online'
        },
        {
          username: 'testuser2',
          email: 'test2@example.com',
          status: 'offline'
        }
      ])
      .returning()
      .execute();

    // Create test rooms
    const [room1, room2] = await db.insert(chatRoomsTable)
      .values([
        {
          name: 'Test Room 1',
          created_by: user1.id
        },
        {
          name: 'Test Room 2',
          created_by: user1.id
        }
      ])
      .returning()
      .execute();

    // Create uploads with different combinations
    await db.insert(uploadsTable)
      .values([
        {
          user_id: user1.id,
          filename: 'user1-room1.jpg',
          file_url: 'https://example.com/u1r1.jpg',
          file_size: 1024,
          file_type: 'image/jpeg',
          room_id: room1.id
        },
        {
          user_id: user1.id,
          filename: 'user1-room2.jpg',
          file_url: 'https://example.com/u1r2.jpg',
          file_size: 1024,
          file_type: 'image/jpeg',
          room_id: room2.id
        },
        {
          user_id: user2.id,
          filename: 'user2-room1.jpg',
          file_url: 'https://example.com/u2r1.jpg',
          file_size: 2048,
          file_type: 'image/jpeg',
          room_id: room1.id
        }
      ])
      .execute();

    const input = getUploadsInputSchema.parse({
      room_id: room1.id,
      user_id: user1.id
    });

    const result = await getUploads(input);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toEqual('user1-room1.jpg');
    expect(result[0].room_id).toEqual(room1.id);
    expect(result[0].user_id).toEqual(user1.id);
    expect(result[0].user.username).toEqual('testuser1');
  });

  it('should handle pagination correctly', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    // Create test room
    const [room] = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        created_by: user.id
      })
      .returning()
      .execute();

    // Create multiple uploads
    const uploadValues = [];
    for (let i = 1; i <= 5; i++) {
      uploadValues.push({
        user_id: user.id,
        filename: `file${i}.jpg`,
        file_url: `https://example.com/file${i}.jpg`,
        file_size: i * 1024,
        file_type: 'image/jpeg',
        room_id: room.id
      });
    }
    await db.insert(uploadsTable).values(uploadValues).execute();

    // Test first page
    const page1 = await getUploads(getUploadsInputSchema.parse({
      limit: 2,
      offset: 0
    }));

    expect(page1).toHaveLength(2);

    // Test second page
    const page2 = await getUploads(getUploadsInputSchema.parse({
      limit: 2,
      offset: 2
    }));

    expect(page2).toHaveLength(2);

    // Test third page
    const page3 = await getUploads(getUploadsInputSchema.parse({
      limit: 2,
      offset: 4
    }));

    expect(page3).toHaveLength(1);

    // Ensure no overlaps
    const allIds = [...page1, ...page2, ...page3].map(upload => upload.id);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toEqual(allIds.length);
  });

  it('should return empty array when no uploads found', async () => {
    const input = getUploadsInputSchema.parse({});

    const result = await getUploads(input);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should handle uploads with no comments', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    // Create test upload without comments
    await db.insert(uploadsTable)
      .values({
        user_id: user.id,
        filename: 'no-comments.jpg',
        file_url: 'https://example.com/nocomments.jpg',
        file_size: 1024,
        file_type: 'image/jpeg',
        room_id: null
      })
      .execute();

    const input = getUploadsInputSchema.parse({});

    const result = await getUploads(input);

    expect(result).toHaveLength(1);
    expect(result[0].comment_count).toEqual(0);
    expect(result[0].filename).toEqual('no-comments.jpg');
  });

  it('should handle uploads with avatar_url', async () => {
    // Create test user with avatar
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        status: 'online'
      })
      .returning()
      .execute();

    // Create test upload
    await db.insert(uploadsTable)
      .values({
        user_id: user.id,
        filename: 'test.jpg',
        file_url: 'https://example.com/test.jpg',
        file_size: 1024,
        file_type: 'image/jpeg',
        room_id: null
      })
      .execute();

    const input = getUploadsInputSchema.parse({});

    const result = await getUploads(input);

    expect(result).toHaveLength(1);
    expect(result[0].user.avatar_url).toEqual('https://example.com/avatar.jpg');
  });
});