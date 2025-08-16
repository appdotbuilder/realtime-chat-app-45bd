import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { chatRoomsTable, roomMembersTable, usersTable } from '../db/schema';
import { type CreateChatRoomInput } from '../schema';
import { createChatRoom } from '../handlers/create_chat_room';
import { eq } from 'drizzle-orm';

describe('createChatRoom', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create a test user first since chat rooms require a valid creator
  const createTestUser = async () => {
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'online'
      })
      .returning()
      .execute();
    return userResult[0];
  };

  it('should create a basic chat room with required fields', async () => {
    const testUser = await createTestUser();
    
    const testInput: CreateChatRoomInput = {
      name: 'Test Room',
      created_by: testUser.id
    };

    const result = await createChatRoom(testInput);

    expect(result.name).toEqual('Test Room');
    expect(result.description).toBeNull();
    expect(result.is_private).toBe(false);
    expect(result.created_by).toEqual(testUser.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a chat room with all optional fields', async () => {
    const testUser = await createTestUser();
    
    const testInput: CreateChatRoomInput = {
      name: 'Private Test Room',
      description: 'A room for testing private features',
      is_private: true,
      created_by: testUser.id
    };

    const result = await createChatRoom(testInput);

    expect(result.name).toEqual('Private Test Room');
    expect(result.description).toEqual('A room for testing private features');
    expect(result.is_private).toBe(true);
    expect(result.created_by).toEqual(testUser.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save chat room to database', async () => {
    const testUser = await createTestUser();
    
    const testInput: CreateChatRoomInput = {
      name: 'Database Test Room',
      description: 'Testing database persistence',
      is_private: false,
      created_by: testUser.id
    };

    const result = await createChatRoom(testInput);

    const chatRooms = await db.select()
      .from(chatRoomsTable)
      .where(eq(chatRoomsTable.id, result.id))
      .execute();

    expect(chatRooms).toHaveLength(1);
    expect(chatRooms[0].name).toEqual('Database Test Room');
    expect(chatRooms[0].description).toEqual('Testing database persistence');
    expect(chatRooms[0].is_private).toBe(false);
    expect(chatRooms[0].created_by).toEqual(testUser.id);
    expect(chatRooms[0].created_at).toBeInstanceOf(Date);
    expect(chatRooms[0].updated_at).toBeInstanceOf(Date);
  });

  it('should automatically add creator as admin member', async () => {
    const testUser = await createTestUser();
    
    const testInput: CreateChatRoomInput = {
      name: 'Admin Test Room',
      created_by: testUser.id
    };

    const result = await createChatRoom(testInput);

    // Verify the creator is added as an admin member
    const roomMembers = await db.select()
      .from(roomMembersTable)
      .where(eq(roomMembersTable.room_id, result.id))
      .execute();

    expect(roomMembers).toHaveLength(1);
    expect(roomMembers[0].room_id).toEqual(result.id);
    expect(roomMembers[0].user_id).toEqual(testUser.id);
    expect(roomMembers[0].role).toEqual('admin');
    expect(roomMembers[0].joined_at).toBeInstanceOf(Date);
  });

  it('should handle null description correctly', async () => {
    const testUser = await createTestUser();
    
    const testInput: CreateChatRoomInput = {
      name: 'Null Description Room',
      description: null,
      created_by: testUser.id
    };

    const result = await createChatRoom(testInput);

    expect(result.description).toBeNull();

    // Verify in database
    const chatRooms = await db.select()
      .from(chatRoomsTable)
      .where(eq(chatRoomsTable.id, result.id))
      .execute();

    expect(chatRooms[0].description).toBeNull();
  });

  it('should throw error for non-existent user', async () => {
    const testInput: CreateChatRoomInput = {
      name: 'Invalid User Room',
      created_by: 99999 // Non-existent user ID
    };

    await expect(createChatRoom(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should create multiple rooms for same user', async () => {
    const testUser = await createTestUser();
    
    const input1: CreateChatRoomInput = {
      name: 'Room One',
      created_by: testUser.id
    };

    const input2: CreateChatRoomInput = {
      name: 'Room Two',
      description: 'Second room',
      is_private: true,
      created_by: testUser.id
    };

    const result1 = await createChatRoom(input1);
    const result2 = await createChatRoom(input2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('Room One');
    expect(result2.name).toEqual('Room Two');
    expect(result1.created_by).toEqual(testUser.id);
    expect(result2.created_by).toEqual(testUser.id);

    // Verify both rooms have the user as admin
    const roomMembers = await db.select()
      .from(roomMembersTable)
      .where(eq(roomMembersTable.user_id, testUser.id))
      .execute();

    expect(roomMembers).toHaveLength(2);
    roomMembers.forEach(member => {
      expect(member.role).toEqual('admin');
      expect(member.user_id).toEqual(testUser.id);
    });
  });
});