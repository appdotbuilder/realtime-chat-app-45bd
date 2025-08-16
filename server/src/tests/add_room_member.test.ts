import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatRoomsTable, roomMembersTable, pushNotificationsTable } from '../db/schema';
import { type CreateRoomMemberInput } from '../schema';
import { addRoomMember } from '../handlers/add_room_member';
import { eq, and } from 'drizzle-orm';

describe('addRoomMember', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testRoomId: number;
  let testCreatorId: number;

  beforeEach(async () => {
    // Create test creator user
    const creatorResult = await db.insert(usersTable)
      .values({
        username: 'room_creator',
        email: 'creator@test.com',
        status: 'online'
      })
      .returning()
      .execute();
    testCreatorId = creatorResult[0].id;

    // Create test user to be added
    const userResult = await db.insert(usersTable)
      .values({
        username: 'test_member',
        email: 'member@test.com',
        status: 'online'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test chat room
    const roomResult = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        description: 'A room for testing',
        is_private: false,
        created_by: testCreatorId
      })
      .returning()
      .execute();
    testRoomId = roomResult[0].id;
  });

  const testInput: CreateRoomMemberInput = {
    room_id: 0, // Will be set in beforeEach
    user_id: 0, // Will be set in beforeEach
    role: 'member'
  };

  it('should add a room member with default role', async () => {
    const input = {
      ...testInput,
      room_id: testRoomId,
      user_id: testUserId
    };
    delete input.role; // Test default role behavior

    const result = await addRoomMember(input);

    expect(result.room_id).toEqual(testRoomId);
    expect(result.user_id).toEqual(testUserId);
    expect(result.role).toEqual('member');
    expect(result.id).toBeDefined();
    expect(result.joined_at).toBeInstanceOf(Date);
  });

  it('should add a room member with specified role', async () => {
    const input = {
      room_id: testRoomId,
      user_id: testUserId,
      role: 'moderator' as const
    };

    const result = await addRoomMember(input);

    expect(result.room_id).toEqual(testRoomId);
    expect(result.user_id).toEqual(testUserId);
    expect(result.role).toEqual('moderator');
    expect(result.id).toBeDefined();
    expect(result.joined_at).toBeInstanceOf(Date);
  });

  it('should save room member to database', async () => {
    const input = {
      room_id: testRoomId,
      user_id: testUserId,
      role: 'admin' as const
    };

    const result = await addRoomMember(input);

    const savedMembers = await db.select()
      .from(roomMembersTable)
      .where(eq(roomMembersTable.id, result.id))
      .execute();

    expect(savedMembers).toHaveLength(1);
    expect(savedMembers[0].room_id).toEqual(testRoomId);
    expect(savedMembers[0].user_id).toEqual(testUserId);
    expect(savedMembers[0].role).toEqual('admin');
    expect(savedMembers[0].joined_at).toBeInstanceOf(Date);
  });

  it('should create room_invite notification for added user', async () => {
    const input = {
      room_id: testRoomId,
      user_id: testUserId,
      role: 'member' as const
    };

    await addRoomMember(input);

    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(
        and(
          eq(pushNotificationsTable.user_id, testUserId),
          eq(pushNotificationsTable.type, 'room_invite')
        )
      )
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toEqual('Room Invitation');
    expect(notifications[0].body).toEqual("You've been added to Test Room");
    expect(notifications[0].type).toEqual('room_invite');
    expect(notifications[0].is_read).toEqual(false);

    const notificationData = JSON.parse(notifications[0].data!);
    expect(notificationData.room_id).toEqual(testRoomId);
    expect(notificationData.room_name).toEqual('Test Room');
  });

  it('should throw error when user does not exist', async () => {
    const input = {
      room_id: testRoomId,
      user_id: 99999, // Non-existent user
      role: 'member' as const
    };

    await expect(addRoomMember(input)).rejects.toThrow(/User with ID 99999 not found/i);
  });

  it('should throw error when room does not exist', async () => {
    const input = {
      room_id: 99999, // Non-existent room
      user_id: testUserId,
      role: 'member' as const
    };

    await expect(addRoomMember(input)).rejects.toThrow(/Chat room with ID 99999 not found/i);
  });

  it('should throw error when user is already a member', async () => {
    const input = {
      room_id: testRoomId,
      user_id: testUserId,
      role: 'member' as const
    };

    // Add user as member first time
    await addRoomMember(input);

    // Try to add same user again
    await expect(addRoomMember(input)).rejects.toThrow(/User \d+ is already a member of room \d+/i);
  });

  it('should allow different users to be added to same room', async () => {
    // Create another test user
    const anotherUserResult = await db.insert(usersTable)
      .values({
        username: 'another_member',
        email: 'another@test.com',
        status: 'offline'
      })
      .returning()
      .execute();
    const anotherUserId = anotherUserResult[0].id;

    const input1 = {
      room_id: testRoomId,
      user_id: testUserId,
      role: 'member' as const
    };

    const input2 = {
      room_id: testRoomId,
      user_id: anotherUserId,
      role: 'moderator' as const
    };

    const result1 = await addRoomMember(input1);
    const result2 = await addRoomMember(input2);

    expect(result1.user_id).toEqual(testUserId);
    expect(result1.role).toEqual('member');
    expect(result2.user_id).toEqual(anotherUserId);
    expect(result2.role).toEqual('moderator');

    // Verify both members exist in database
    const allMembers = await db.select()
      .from(roomMembersTable)
      .where(eq(roomMembersTable.room_id, testRoomId))
      .execute();

    expect(allMembers).toHaveLength(2);
  });

  it('should allow same user to be added to different rooms', async () => {
    // Create another test room
    const anotherRoomResult = await db.insert(chatRoomsTable)
      .values({
        name: 'Another Room',
        description: 'Another room for testing',
        is_private: true,
        created_by: testCreatorId
      })
      .returning()
      .execute();
    const anotherRoomId = anotherRoomResult[0].id;

    const input1 = {
      room_id: testRoomId,
      user_id: testUserId,
      role: 'member' as const
    };

    const input2 = {
      room_id: anotherRoomId,
      user_id: testUserId,
      role: 'admin' as const
    };

    const result1 = await addRoomMember(input1);
    const result2 = await addRoomMember(input2);

    expect(result1.room_id).toEqual(testRoomId);
    expect(result1.role).toEqual('member');
    expect(result2.room_id).toEqual(anotherRoomId);
    expect(result2.role).toEqual('admin');

    // Verify notifications were created for both rooms
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(
        and(
          eq(pushNotificationsTable.user_id, testUserId),
          eq(pushNotificationsTable.type, 'room_invite')
        )
      )
      .execute();

    expect(notifications).toHaveLength(2);
  });
});