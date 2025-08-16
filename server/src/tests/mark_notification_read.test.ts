import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, pushNotificationsTable } from '../db/schema';
import { type MarkNotificationReadInput } from '../schema';
import { markNotificationRead } from '../handlers/mark_notification_read';
import { eq } from 'drizzle-orm';

describe('markNotificationRead', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should mark a notification as read', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a notification
    const notificationResult = await db.insert(pushNotificationsTable)
      .values({
        user_id: user.id,
        title: 'Test Notification',
        body: 'This is a test notification',
        type: 'new_message',
        data: null,
        is_read: false
      })
      .returning()
      .execute();

    const notification = notificationResult[0];

    // Test input
    const input: MarkNotificationReadInput = {
      id: notification.id
    };

    // Call the handler
    const result = await markNotificationRead(input);

    // Verify the result
    expect(result.id).toEqual(notification.id);
    expect(result.user_id).toEqual(user.id);
    expect(result.title).toEqual('Test Notification');
    expect(result.body).toEqual('This is a test notification');
    expect(result.type).toEqual('new_message');
    expect(result.data).toBeNull();
    expect(result.is_read).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update notification in database', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser2',
        email: 'test2@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create an unread notification
    const notificationResult = await db.insert(pushNotificationsTable)
      .values({
        user_id: user.id,
        title: 'Another Test',
        body: 'Another test notification',
        type: 'new_upload',
        data: '{"upload_id": 123}',
        is_read: false
      })
      .returning()
      .execute();

    const notification = notificationResult[0];

    // Verify it's initially unread
    expect(notification.is_read).toBe(false);

    // Mark as read
    await markNotificationRead({ id: notification.id });

    // Query the database to verify it was updated
    const updatedNotifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.id, notification.id))
      .execute();

    expect(updatedNotifications).toHaveLength(1);
    expect(updatedNotifications[0].is_read).toBe(true);
    expect(updatedNotifications[0].title).toEqual('Another Test');
    expect(updatedNotifications[0].body).toEqual('Another test notification');
    expect(updatedNotifications[0].type).toEqual('new_upload');
    expect(updatedNotifications[0].data).toEqual('{"upload_id": 123}');
  });

  it('should handle different notification types correctly', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser3',
        email: 'test3@example.com',
        status: 'away'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create notifications of different types
    const notificationTypes = ['new_message', 'new_upload', 'new_comment', 'status_update', 'room_invite'] as const;

    for (const type of notificationTypes) {
      const notificationResult = await db.insert(pushNotificationsTable)
        .values({
          user_id: user.id,
          title: `${type} notification`,
          body: `This is a ${type} notification`,
          type: type,
          data: type === 'new_comment' ? '{"comment_id": 456}' : null,
          is_read: false
        })
        .returning()
        .execute();

      const notification = notificationResult[0];

      // Mark as read
      const result = await markNotificationRead({ id: notification.id });

      // Verify result
      expect(result.type).toEqual(type);
      expect(result.is_read).toBe(true);
      expect(result.title).toEqual(`${type} notification`);
      expect(result.body).toEqual(`This is a ${type} notification`);
      
      if (type === 'new_comment') {
        expect(result.data).toEqual('{"comment_id": 456}');
      } else {
        expect(result.data).toBeNull();
      }
    }
  });

  it('should throw error when notification does not exist', async () => {
    const nonExistentId = 99999;
    
    const input: MarkNotificationReadInput = {
      id: nonExistentId
    };

    await expect(markNotificationRead(input)).rejects.toThrow(/not found/i);
  });

  it('should work with already read notifications', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser4',
        email: 'test4@example.com',
        status: 'offline'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create an already read notification
    const notificationResult = await db.insert(pushNotificationsTable)
      .values({
        user_id: user.id,
        title: 'Already Read',
        body: 'This notification is already read',
        type: 'status_update',
        data: null,
        is_read: true  // Already read
      })
      .returning()
      .execute();

    const notification = notificationResult[0];

    // Mark as read again (should still work)
    const result = await markNotificationRead({ id: notification.id });

    // Verify it remains read
    expect(result.is_read).toBe(true);
    expect(result.title).toEqual('Already Read');
    expect(result.body).toEqual('This notification is already read');
    expect(result.type).toEqual('status_update');

    // Verify in database
    const dbNotification = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.id, notification.id))
      .execute();

    expect(dbNotification[0].is_read).toBe(true);
  });
});