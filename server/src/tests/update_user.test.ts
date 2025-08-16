import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatRoomsTable, roomMembersTable, pushNotificationsTable } from '../db/schema';
import { type UpdateUserInput } from '../schema';
import { updateUser } from '../handlers/update_user';
import { eq, and } from 'drizzle-orm';

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user basic information', async () => {
    // Create a test user first
    const newUser = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'offline'
      })
      .returning()
      .execute();

    const userId = newUser[0].id;

    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'updateduser',
      email: 'updated@example.com',
      avatar_url: 'https://example.com/avatar.jpg',
      status: 'online'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.username).toEqual('updateduser');
    expect(result.email).toEqual('updated@example.com');
    expect(result.avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(result.status).toEqual('online');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update only provided fields', async () => {
    // Create a test user
    const newUser = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        avatar_url: 'https://example.com/old.jpg',
        status: 'offline'
      })
      .returning()
      .execute();

    const userId = newUser[0].id;

    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'newusername'
      // Only updating username, other fields should remain unchanged
    };

    const result = await updateUser(updateInput);

    expect(result.username).toEqual('newusername');
    expect(result.email).toEqual('test@example.com'); // Should remain unchanged
    expect(result.avatar_url).toEqual('https://example.com/old.jpg'); // Should remain unchanged
    expect(result.status).toEqual('offline'); // Should remain unchanged
  });

  it('should persist changes to database', async () => {
    // Create a test user
    const newUser = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'offline'
      })
      .returning()
      .execute();

    const userId = newUser[0].id;

    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'persisteduser',
      status: 'online'
    };

    await updateUser(updateInput);

    // Verify the changes were persisted
    const dbUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(dbUser).toHaveLength(1);
    expect(dbUser[0].username).toEqual('persisteduser');
    expect(dbUser[0].status).toEqual('online');
  });

  it('should create status update notifications when status changes', async () => {
    // Create test users
    const user1 = await db.insert(usersTable)
      .values({
        username: 'user1',
        email: 'user1@example.com',
        status: 'offline'
      })
      .returning()
      .execute();

    const user2 = await db.insert(usersTable)
      .values({
        username: 'user2',
        email: 'user2@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    const user3 = await db.insert(usersTable)
      .values({
        username: 'user3',
        email: 'user3@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    // Create a chat room
    const chatRoom = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        created_by: user1[0].id
      })
      .returning()
      .execute();

    // Add users to the room
    await db.insert(roomMembersTable)
      .values([
        { room_id: chatRoom[0].id, user_id: user1[0].id, role: 'admin' },
        { room_id: chatRoom[0].id, user_id: user2[0].id, role: 'member' },
        { room_id: chatRoom[0].id, user_id: user3[0].id, role: 'member' }
      ])
      .execute();

    // Update user1's status
    const updateInput: UpdateUserInput = {
      id: user1[0].id,
      status: 'online'
    };

    await updateUser(updateInput);

    // Check that notifications were created for user2 and user3
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.type, 'status_update'))
      .execute();

    expect(notifications).toHaveLength(2);
    
    // Verify notification details
    const notificationUserIds = notifications.map(n => n.user_id).sort();
    expect(notificationUserIds).toEqual([user2[0].id, user3[0].id].sort());

    const notification = notifications[0];
    expect(notification.title).toEqual('User Status Update');
    expect(notification.body).toEqual('user1 is now online');
    expect(notification.type).toEqual('status_update');
    expect(notification.is_read).toBe(false);
    
    const notificationData = JSON.parse(notification.data!);
    expect(notificationData.user_id).toEqual(user1[0].id);
    expect(notificationData.username).toEqual('user1');
    expect(notificationData.old_status).toEqual('offline');
    expect(notificationData.new_status).toEqual('online');
  });

  it('should not create notifications when status does not change', async () => {
    // Create test users and room
    const user1 = await db.insert(usersTable)
      .values({
        username: 'user1',
        email: 'user1@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    const user2 = await db.insert(usersTable)
      .values({
        username: 'user2',
        email: 'user2@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    const chatRoom = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        created_by: user1[0].id
      })
      .returning()
      .execute();

    await db.insert(roomMembersTable)
      .values([
        { room_id: chatRoom[0].id, user_id: user1[0].id, role: 'admin' },
        { room_id: chatRoom[0].id, user_id: user2[0].id, role: 'member' }
      ])
      .execute();

    // Update user1's username but keep status the same
    const updateInput: UpdateUserInput = {
      id: user1[0].id,
      username: 'newusername',
      status: 'online' // Same as before
    };

    await updateUser(updateInput);

    // Check that no notifications were created
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.type, 'status_update'))
      .execute();

    expect(notifications).toHaveLength(0);
  });

  it('should not create notifications when status is not updated', async () => {
    // Create test users and room
    const user1 = await db.insert(usersTable)
      .values({
        username: 'user1',
        email: 'user1@example.com',
        status: 'offline'
      })
      .returning()
      .execute();

    const user2 = await db.insert(usersTable)
      .values({
        username: 'user2',
        email: 'user2@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    const chatRoom = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        created_by: user1[0].id
      })
      .returning()
      .execute();

    await db.insert(roomMembersTable)
      .values([
        { room_id: chatRoom[0].id, user_id: user1[0].id, role: 'admin' },
        { room_id: chatRoom[0].id, user_id: user2[0].id, role: 'member' }
      ])
      .execute();

    // Update user1's email but don't change status
    const updateInput: UpdateUserInput = {
      id: user1[0].id,
      email: 'newemail@example.com'
      // No status field provided
    };

    await updateUser(updateInput);

    // Check that no notifications were created
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.type, 'status_update'))
      .execute();

    expect(notifications).toHaveLength(0);
  });

  it('should handle nullable avatar_url correctly', async () => {
    // Create a test user with avatar
    const newUser = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        status: 'offline'
      })
      .returning()
      .execute();

    const userId = newUser[0].id;

    // Update to set avatar_url to null
    const updateInput: UpdateUserInput = {
      id: userId,
      avatar_url: null
    };

    const result = await updateUser(updateInput);

    expect(result.avatar_url).toBeNull();

    // Verify in database
    const dbUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(dbUser[0].avatar_url).toBeNull();
  });

  it('should throw error when user does not exist', async () => {
    const updateInput: UpdateUserInput = {
      id: 99999, // Non-existent user ID
      username: 'nonexistent'
    };

    await expect(updateUser(updateInput)).rejects.toThrow(/User not found/i);
  });

  it('should handle users in multiple rooms correctly', async () => {
    // Create test users
    const user1 = await db.insert(usersTable)
      .values({
        username: 'user1',
        email: 'user1@example.com',
        status: 'offline'
      })
      .returning()
      .execute();

    const user2 = await db.insert(usersTable)
      .values({
        username: 'user2',
        email: 'user2@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    const user3 = await db.insert(usersTable)
      .values({
        username: 'user3',
        email: 'user3@example.com',
        status: 'away'
      })
      .returning()
      .execute();

    // Create two chat rooms
    const room1 = await db.insert(chatRoomsTable)
      .values({
        name: 'Room 1',
        created_by: user1[0].id
      })
      .returning()
      .execute();

    const room2 = await db.insert(chatRoomsTable)
      .values({
        name: 'Room 2',
        created_by: user1[0].id
      })
      .returning()
      .execute();

    // Add users to rooms - user1 and user2 in both rooms, user3 only in room1
    await db.insert(roomMembersTable)
      .values([
        // Room 1: user1, user2, user3
        { room_id: room1[0].id, user_id: user1[0].id, role: 'admin' },
        { room_id: room1[0].id, user_id: user2[0].id, role: 'member' },
        { room_id: room1[0].id, user_id: user3[0].id, role: 'member' },
        // Room 2: user1, user2
        { room_id: room2[0].id, user_id: user1[0].id, role: 'admin' },
        { room_id: room2[0].id, user_id: user2[0].id, role: 'member' }
      ])
      .execute();

    // Update user1's status
    const updateInput: UpdateUserInput = {
      id: user1[0].id,
      status: 'online'
    };

    await updateUser(updateInput);

    // Check notifications - should create for user2 and user3, but not duplicate for user2
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.type, 'status_update'))
      .execute();

    // Should have exactly 2 notifications (one for user2, one for user3)
    expect(notifications).toHaveLength(2);
    
    const notificationUserIds = notifications.map(n => n.user_id).sort();
    expect(notificationUserIds).toEqual([user2[0].id, user3[0].id].sort());
  });
});