import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, pushNotificationsTable } from '../db/schema';
import { type GetUserNotificationsInput, type CreateUserInput, type CreatePushNotificationInput } from '../schema';
import { getUserNotifications } from '../handlers/get_user_notifications';

// Test data
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  status: 'online'
};

const testNotification: CreatePushNotificationInput = {
  user_id: 1, // Will be updated after user creation
  title: 'Test Notification',
  body: 'This is a test notification',
  type: 'new_message',
  data: '{"room_id": 1}'
};

describe('getUserNotifications', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get notifications for a user', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        status: testUser.status || 'offline'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test notification
    await db.insert(pushNotificationsTable)
      .values({
        user_id: userId,
        title: testNotification.title,
        body: testNotification.body,
        type: testNotification.type,
        data: testNotification.data || null,
        is_read: false
      })
      .execute();

    const input: GetUserNotificationsInput = {
      user_id: userId
    };

    const result = await getUserNotifications(input);

    // Basic validation
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toEqual(userId);
    expect(result[0].title).toEqual('Test Notification');
    expect(result[0].body).toEqual('This is a test notification');
    expect(result[0].type).toEqual('new_message');
    expect(result[0].data).toEqual('{"room_id": 1}');
    expect(result[0].is_read).toEqual(false);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return empty array for user with no notifications', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        status: testUser.status || 'offline'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const input: GetUserNotificationsInput = {
      user_id: userId
    };

    const result = await getUserNotifications(input);

    expect(result).toHaveLength(0);
  });

  it('should support pagination with limit and offset', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        status: testUser.status || 'offline'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create multiple notifications
    const notifications = [
      { title: 'First Notification', body: 'First body', type: 'new_message' as const },
      { title: 'Second Notification', body: 'Second body', type: 'new_upload' as const },
      { title: 'Third Notification', body: 'Third body', type: 'new_comment' as const }
    ];

    for (const notif of notifications) {
      await db.insert(pushNotificationsTable)
        .values({
          user_id: userId,
          title: notif.title,
          body: notif.body,
          type: notif.type,
          is_read: false
        })
        .execute();
    }

    // Test with limit
    const limitedResult = await getUserNotifications({
      user_id: userId,
      limit: 2
    });

    expect(limitedResult).toHaveLength(2);

    // Test with offset
    const offsetResult = await getUserNotifications({
      user_id: userId,
      limit: 2,
      offset: 1
    });

    expect(offsetResult).toHaveLength(2);
    // Verify different results due to offset
    expect(offsetResult[0].id).not.toEqual(limitedResult[0].id);
  });

  it('should order notifications by created_at descending (newest first)', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        status: testUser.status || 'offline'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create notifications with different timestamps by inserting with delays
    const firstNotification = await db.insert(pushNotificationsTable)
      .values({
        user_id: userId,
        title: 'First Notification',
        body: 'First body',
        type: 'new_message',
        is_read: false
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondNotification = await db.insert(pushNotificationsTable)
      .values({
        user_id: userId,
        title: 'Second Notification',
        body: 'Second body',
        type: 'new_upload',
        is_read: false
      })
      .returning()
      .execute();

    const result = await getUserNotifications({
      user_id: userId
    });

    expect(result).toHaveLength(2);
    // Newer notification should come first
    expect(result[0].created_at.getTime()).toBeGreaterThanOrEqual(result[1].created_at.getTime());
    expect(result[0].title).toEqual('Second Notification');
    expect(result[1].title).toEqual('First Notification');
  });

  it('should handle different notification types correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        status: testUser.status || 'offline'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create notifications of different types
    const notificationTypes = [
      'new_message' as const,
      'new_upload' as const,
      'new_comment' as const,
      'status_update' as const,
      'room_invite' as const
    ];

    for (const type of notificationTypes) {
      await db.insert(pushNotificationsTable)
        .values({
          user_id: userId,
          title: `${type} notification`,
          body: `Body for ${type}`,
          type: type,
          is_read: false
        })
        .execute();
    }

    const result = await getUserNotifications({
      user_id: userId
    });

    expect(result).toHaveLength(5);
    
    const resultTypes = result.map(n => n.type).sort();
    const expectedTypes = notificationTypes.sort();
    expect(resultTypes).toEqual(expectedTypes);
  });

  it('should handle read and unread notifications correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        status: testUser.status || 'offline'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create read and unread notifications
    await db.insert(pushNotificationsTable)
      .values({
        user_id: userId,
        title: 'Read Notification',
        body: 'This is read',
        type: 'new_message',
        is_read: true
      })
      .execute();

    await db.insert(pushNotificationsTable)
      .values({
        user_id: userId,
        title: 'Unread Notification',
        body: 'This is unread',
        type: 'new_upload',
        is_read: false
      })
      .execute();

    const result = await getUserNotifications({
      user_id: userId
    });

    expect(result).toHaveLength(2);
    
    const readNotification = result.find(n => n.is_read === true);
    const unreadNotification = result.find(n => n.is_read === false);

    expect(readNotification).toBeDefined();
    expect(readNotification?.title).toEqual('Read Notification');
    expect(unreadNotification).toBeDefined();
    expect(unreadNotification?.title).toEqual('Unread Notification');
  });

  it('should handle notifications with null data field', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        status: testUser.status || 'offline'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create notification with null data
    await db.insert(pushNotificationsTable)
      .values({
        user_id: userId,
        title: 'Notification with null data',
        body: 'This has no additional data',
        type: 'status_update',
        data: null,
        is_read: false
      })
      .execute();

    const result = await getUserNotifications({
      user_id: userId
    });

    expect(result).toHaveLength(1);
    expect(result[0].data).toBeNull();
    expect(result[0].title).toEqual('Notification with null data');
  });

  it('should not return notifications for other users', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values({
        username: 'user1',
        email: 'user1@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        username: 'user2',
        email: 'user2@example.com',
        status: 'offline'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create notification for user1
    await db.insert(pushNotificationsTable)
      .values({
        user_id: user1Id,
        title: 'User 1 Notification',
        body: 'This is for user 1',
        type: 'new_message',
        is_read: false
      })
      .execute();

    // Create notification for user2
    await db.insert(pushNotificationsTable)
      .values({
        user_id: user2Id,
        title: 'User 2 Notification',
        body: 'This is for user 2',
        type: 'new_upload',
        is_read: false
      })
      .execute();

    // Get notifications for user1
    const user1Notifications = await getUserNotifications({
      user_id: user1Id
    });

    expect(user1Notifications).toHaveLength(1);
    expect(user1Notifications[0].title).toEqual('User 1 Notification');
    expect(user1Notifications[0].user_id).toEqual(user1Id);

    // Get notifications for user2
    const user2Notifications = await getUserNotifications({
      user_id: user2Id
    });

    expect(user2Notifications).toHaveLength(1);
    expect(user2Notifications[0].title).toEqual('User 2 Notification');
    expect(user2Notifications[0].user_id).toEqual(user2Id);
  });
});