import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatRoomsTable, roomMembersTable } from '../db/schema';
import { type GetUserRoomsInput } from '../schema';
import { getUserRooms } from '../handlers/get_user_rooms';

describe('getUserRooms', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return rooms where user is a member', async () => {
    // Create test user
    const userResults = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();
    const user = userResults[0];

    // Create another user for room creation
    const creatorResults = await db.insert(usersTable)
      .values({
        username: 'creator',
        email: 'creator@example.com'
      })
      .returning()
      .execute();
    const creator = creatorResults[0];

    // Create test rooms
    const roomResults = await db.insert(chatRoomsTable)
      .values([
        {
          name: 'General Chat',
          description: 'General discussion room',
          is_private: false,
          created_by: creator.id
        },
        {
          name: 'Private Room',
          description: 'Private discussion room',
          is_private: true,
          created_by: creator.id
        }
      ])
      .returning()
      .execute();
    const [room1, room2] = roomResults;

    // Add user as member to both rooms
    await db.insert(roomMembersTable)
      .values([
        {
          room_id: room1.id,
          user_id: user.id,
          role: 'member'
        },
        {
          room_id: room2.id,
          user_id: user.id,
          role: 'admin'
        }
      ])
      .execute();

    const input: GetUserRoomsInput = {
      user_id: user.id
    };

    const result = await getUserRooms(input);

    expect(result).toHaveLength(2);
    
    // Verify room details
    const roomNames = result.map(room => room.name).sort();
    expect(roomNames).toEqual(['General Chat', 'Private Room']);

    // Check specific room properties
    const generalRoom = result.find(room => room.name === 'General Chat');
    expect(generalRoom).toBeDefined();
    expect(generalRoom!.description).toEqual('General discussion room');
    expect(generalRoom!.is_private).toBe(false);
    expect(generalRoom!.created_by).toEqual(creator.id);
    expect(generalRoom!.id).toBeDefined();
    expect(generalRoom!.created_at).toBeInstanceOf(Date);
    expect(generalRoom!.updated_at).toBeInstanceOf(Date);

    const privateRoom = result.find(room => room.name === 'Private Room');
    expect(privateRoom).toBeDefined();
    expect(privateRoom!.is_private).toBe(true);
  });

  it('should return empty array when user is not a member of any rooms', async () => {
    // Create test user
    const userResults = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();
    const user = userResults[0];

    // Create another user and room but don't add first user as member
    const creatorResults = await db.insert(usersTable)
      .values({
        username: 'creator',
        email: 'creator@example.com'
      })
      .returning()
      .execute();
    const creator = creatorResults[0];

    await db.insert(chatRoomsTable)
      .values({
        name: 'Exclusive Room',
        description: 'Room user is not member of',
        created_by: creator.id
      })
      .execute();

    const input: GetUserRoomsInput = {
      user_id: user.id
    };

    const result = await getUserRooms(input);

    expect(result).toHaveLength(0);
  });

  it('should only return rooms for the specific user', async () => {
    // Create two test users
    const userResults = await db.insert(usersTable)
      .values([
        {
          username: 'user1',
          email: 'user1@example.com'
        },
        {
          username: 'user2',
          email: 'user2@example.com'
        }
      ])
      .returning()
      .execute();
    const [user1, user2] = userResults;

    // Create room
    const roomResults = await db.insert(chatRoomsTable)
      .values({
        name: 'Shared Room',
        description: 'Room with multiple members',
        created_by: user1.id
      })
      .returning()
      .execute();
    const room = roomResults[0];

    // Add only user1 as member
    await db.insert(roomMembersTable)
      .values({
        room_id: room.id,
        user_id: user1.id,
        role: 'admin'
      })
      .execute();

    // Test for user1 - should return the room
    const input1: GetUserRoomsInput = {
      user_id: user1.id
    };
    const result1 = await getUserRooms(input1);
    expect(result1).toHaveLength(1);
    expect(result1[0].name).toEqual('Shared Room');

    // Test for user2 - should return empty array
    const input2: GetUserRoomsInput = {
      user_id: user2.id
    };
    const result2 = await getUserRooms(input2);
    expect(result2).toHaveLength(0);
  });

  it('should handle non-existent user gracefully', async () => {
    const input: GetUserRoomsInput = {
      user_id: 9999 // Non-existent user ID
    };

    const result = await getUserRooms(input);

    expect(result).toHaveLength(0);
  });

  it('should return rooms with different member roles', async () => {
    // Create test user
    const userResults = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com'
      })
      .returning()
      .execute();
    const user = userResults[0];

    // Create another user for room creation
    const creatorResults = await db.insert(usersTable)
      .values({
        username: 'creator',
        email: 'creator@example.com'
      })
      .returning()
      .execute();
    const creator = creatorResults[0];

    // Create multiple rooms
    const roomResults = await db.insert(chatRoomsTable)
      .values([
        {
          name: 'Admin Room',
          created_by: creator.id
        },
        {
          name: 'Moderator Room',
          created_by: creator.id
        },
        {
          name: 'Member Room',
          created_by: creator.id
        }
      ])
      .returning()
      .execute();
    const [adminRoom, modRoom, memberRoom] = roomResults;

    // Add user with different roles
    await db.insert(roomMembersTable)
      .values([
        {
          room_id: adminRoom.id,
          user_id: user.id,
          role: 'admin'
        },
        {
          room_id: modRoom.id,
          user_id: user.id,
          role: 'moderator'
        },
        {
          room_id: memberRoom.id,
          user_id: user.id,
          role: 'member'
        }
      ])
      .execute();

    const input: GetUserRoomsInput = {
      user_id: user.id
    };

    const result = await getUserRooms(input);

    expect(result).toHaveLength(3);
    
    const roomNames = result.map(room => room.name).sort();
    expect(roomNames).toEqual(['Admin Room', 'Member Room', 'Moderator Room']);
  });
});