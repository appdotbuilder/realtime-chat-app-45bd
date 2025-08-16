import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pushNotificationsTable, usersTable } from '../db/schema';
import { type CreatePushNotificationInput } from '../schema';
import { createPushNotification } from '../handlers/create_push_notification';
import { eq } from 'drizzle-orm';

// Test user for foreign key reference
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  status: 'online' as const
};

// Simple test input
const testInput: CreatePushNotificationInput = {
  user_id: 1, // Will be set after user creation
  title: 'Test Notification',
  body: 'This is a test notification',
  type: 'new_message',
  data: JSON.stringify({ message_id: 123 })
};

describe('createPushNotification', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a push notification with all fields', async () => {
    // Create test user first
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input = { ...testInput, user_id: user.id };
    const result = await createPushNotification(input);

    // Basic field validation
    expect(result.title).toEqual('Test Notification');
    expect(result.body).toEqual('This is a test notification');
    expect(result.type).toEqual('new_message');
    expect(result.user_id).toEqual(user.id);
    expect(result.data).toEqual(JSON.stringify({ message_id: 123 }));
    expect(result.is_read).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a notification with null data', async () => {
    // Create test user first
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input: CreatePushNotificationInput = {
      user_id: user.id,
      title: 'Simple Notification',
      body: 'No additional data',
      type: 'status_update'
      // data field omitted (optional)
    };

    const result = await createPushNotification(input);

    expect(result.title).toEqual('Simple Notification');
    expect(result.body).toEqual('No additional data');
    expect(result.type).toEqual('status_update');
    expect(result.data).toBeNull();
    expect(result.is_read).toEqual(false);
  });

  it('should save notification to database', async () => {
    // Create test user first
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input = { ...testInput, user_id: user.id };
    const result = await createPushNotification(input);

    // Query using proper drizzle syntax
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.id, result.id))
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toEqual('Test Notification');
    expect(notifications[0].body).toEqual('This is a test notification');
    expect(notifications[0].type).toEqual('new_message');
    expect(notifications[0].user_id).toEqual(user.id);
    expect(notifications[0].data).toEqual(JSON.stringify({ message_id: 123 }));
    expect(notifications[0].is_read).toEqual(false);
    expect(notifications[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle different notification types', async () => {
    // Create test user first
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const notificationTypes = ['new_message', 'new_upload', 'new_comment', 'status_update', 'room_invite'] as const;

    for (const type of notificationTypes) {
      const input: CreatePushNotificationInput = {
        user_id: user.id,
        title: `Test ${type}`,
        body: `Test notification for ${type}`,
        type: type
      };

      const result = await createPushNotification(input);
      expect(result.type).toEqual(type);
      expect(result.title).toEqual(`Test ${type}`);
    }

    // Verify all notifications were created
    const allNotifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.user_id, user.id))
      .execute();

    expect(allNotifications).toHaveLength(5);
  });

  it('should create notifications with complex JSON data', async () => {
    // Create test user first
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const complexData = {
      room_id: 456,
      sender_id: 789,
      message_content: 'Hello world!',
      timestamp: new Date().toISOString(),
      metadata: {
        urgent: true,
        category: 'chat'
      }
    };

    const input: CreatePushNotificationInput = {
      user_id: user.id,
      title: 'Complex Notification',
      body: 'Notification with complex data',
      type: 'new_message',
      data: JSON.stringify(complexData)
    };

    const result = await createPushNotification(input);

    expect(result.data).toEqual(JSON.stringify(complexData));
    
    // Verify data can be parsed back
    const parsedData = JSON.parse(result.data!);
    expect(parsedData.room_id).toEqual(456);
    expect(parsedData.metadata.urgent).toEqual(true);
  });

  it('should handle foreign key constraint violation', async () => {
    const input: CreatePushNotificationInput = {
      user_id: 999, // Non-existent user
      title: 'Invalid Notification',
      body: 'This should fail',
      type: 'new_message'
    };

    await expect(createPushNotification(input)).rejects.toThrow(/violates foreign key constraint/i);
  });
});