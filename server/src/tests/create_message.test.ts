import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatRoomsTable, messagesTable, roomMembersTable, pushNotificationsTable } from '../db/schema';
import { type CreateMessageInput } from '../schema';
import { createMessage } from '../handlers/create_message';
import { eq, and } from 'drizzle-orm';

describe('createMessage', () => {
  let testUser: any;
  let otherUser: any;
  let testRoom: any;
  let testInput: CreateMessageInput;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const userResults = await db.insert(usersTable)
      .values([
        {
          username: 'testuser',
          email: 'test@example.com',
          status: 'online'
        },
        {
          username: 'otheruser',
          email: 'other@example.com',
          status: 'online'
        }
      ])
      .returning()
      .execute();

    testUser = userResults[0];
    otherUser = userResults[1];

    // Create test room
    const roomResults = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        description: 'A test chat room',
        is_private: false,
        created_by: testUser.id
      })
      .returning()
      .execute();

    testRoom = roomResults[0];

    // Add both users as room members
    await db.insert(roomMembersTable)
      .values([
        {
          room_id: testRoom.id,
          user_id: testUser.id,
          role: 'admin'
        },
        {
          room_id: testRoom.id,
          user_id: otherUser.id,
          role: 'member'
        }
      ])
      .execute();

    testInput = {
      room_id: testRoom.id,
      user_id: testUser.id,
      content: 'Hello, this is a test message!',
      message_type: 'text',
      file_url: null,
      reply_to_id: null
    };
  });

  afterEach(resetDB);

  it('should create a message successfully', async () => {
    const result = await createMessage(testInput);

    expect(result.room_id).toBe(testRoom.id);
    expect(result.user_id).toBe(testUser.id);
    expect(result.content).toBe('Hello, this is a test message!');
    expect(result.message_type).toBe('text');
    expect(result.file_url).toBe(null);
    expect(result.reply_to_id).toBe(null);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save message to database', async () => {
    const result = await createMessage(testInput);

    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello, this is a test message!');
    expect(messages[0].room_id).toBe(testRoom.id);
    expect(messages[0].user_id).toBe(testUser.id);
    expect(messages[0].message_type).toBe('text');
  });

  it('should create notifications for other room members', async () => {
    await createMessage(testInput);

    // Check notifications were created for the other user
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.user_id, otherUser.id))
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('New Message');
    expect(notifications[0].body).toBe('New message in room: Hello, this is a test message!');
    expect(notifications[0].type).toBe('new_message');
    expect(notifications[0].is_read).toBe(false);
    
    const data = JSON.parse(notifications[0].data!);
    expect(data.room_id).toBe(testRoom.id);
    expect(data.sender_id).toBe(testUser.id);
  });

  it('should not create notification for message sender', async () => {
    await createMessage(testInput);

    // Check no notifications were created for the sender
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.user_id, testUser.id))
      .execute();

    expect(notifications).toHaveLength(0);
  });

  it('should use default message type when not specified', async () => {
    const inputWithoutType: CreateMessageInput = {
      room_id: testRoom.id,
      user_id: testUser.id,
      content: 'Message without type',
      message_type: undefined,
      file_url: null,
      reply_to_id: null
    };

    const result = await createMessage(inputWithoutType);
    expect(result.message_type).toBe('text');
  });

  it('should handle different message types', async () => {
    const imageInput: CreateMessageInput = {
      room_id: testRoom.id,
      user_id: testUser.id,
      content: 'Check out this image!',
      message_type: 'image',
      file_url: 'https://example.com/image.jpg',
      reply_to_id: null
    };

    const result = await createMessage(imageInput);
    expect(result.message_type).toBe('image');
    expect(result.file_url).toBe('https://example.com/image.jpg');
  });

  it('should handle reply messages', async () => {
    // First create an original message
    const originalMessage = await createMessage(testInput);

    // Create a reply message
    const replyInput: CreateMessageInput = {
      room_id: testRoom.id,
      user_id: otherUser.id,
      content: 'This is a reply',
      message_type: 'text',
      file_url: null,
      reply_to_id: originalMessage.id
    };

    const replyMessage = await createMessage(replyInput);
    expect(replyMessage.reply_to_id).toBe(originalMessage.id);
  });

  it('should truncate long message content in notification body', async () => {
    const longContent = 'This is a very long message content that should be truncated in the notification body to avoid overwhelming users with too much text';
    const longMessageInput: CreateMessageInput = {
      room_id: testRoom.id,
      user_id: testUser.id,
      content: longContent,
      message_type: 'text',
      file_url: null,
      reply_to_id: null
    };

    await createMessage(longMessageInput);

    const notifications = await db.select()
      .from(pushNotificationsTable)
      .where(eq(pushNotificationsTable.user_id, otherUser.id))
      .execute();

    expect(notifications[0].body).toBe('New message in room: This is a very long message content that should be...');
  });

  it('should reject message from non-member user', async () => {
    // Create a user who is not a member of the room
    const nonMemberUser = await db.insert(usersTable)
      .values({
        username: 'nonmember',
        email: 'nonmember@example.com',
        status: 'online'
      })
      .returning()
      .execute();

    const invalidInput: CreateMessageInput = {
      room_id: testRoom.id,
      user_id: nonMemberUser[0].id,
      content: 'Unauthorized message',
      message_type: 'text',
      file_url: null,
      reply_to_id: null
    };

    await expect(createMessage(invalidInput)).rejects.toThrow(/not a member of this room/i);
  });

  it('should reject reply to non-existent message', async () => {
    const invalidReplyInput: CreateMessageInput = {
      room_id: testRoom.id,
      user_id: testUser.id,
      content: 'Reply to nothing',
      message_type: 'text',
      file_url: null,
      reply_to_id: 99999 // Non-existent message ID
    };

    await expect(createMessage(invalidReplyInput)).rejects.toThrow(/reply target message not found/i);
  });

  it('should reject reply to message from different room', async () => {
    // Create another room and message
    const otherRoom = await db.insert(chatRoomsTable)
      .values({
        name: 'Other Room',
        created_by: testUser.id
      })
      .returning()
      .execute();

    // Add testUser as member to other room
    await db.insert(roomMembersTable)
      .values({
        room_id: otherRoom[0].id,
        user_id: testUser.id,
        role: 'admin'
      })
      .execute();

    // Create message in other room
    const otherRoomMessage = await db.insert(messagesTable)
      .values({
        room_id: otherRoom[0].id,
        user_id: testUser.id,
        content: 'Message in other room'
      })
      .returning()
      .execute();

    // Try to reply to message from other room while posting in testRoom
    // testUser is member of both rooms, but trying to reply cross-room
    const invalidReplyInput: CreateMessageInput = {
      room_id: testRoom.id,
      user_id: testUser.id,
      content: 'Invalid cross-room reply',
      message_type: 'text',
      file_url: null,
      reply_to_id: otherRoomMessage[0].id
    };

    await expect(createMessage(invalidReplyInput)).rejects.toThrow(/reply target message not found/i);
  });

  it('should handle room with only one member (no notifications)', async () => {
    // Remove other user from room
    await db.delete(roomMembersTable)
      .where(
        and(
          eq(roomMembersTable.room_id, testRoom.id),
          eq(roomMembersTable.user_id, otherUser.id)
        )
      )
      .execute();

    const result = await createMessage(testInput);
    expect(result).toBeDefined();

    // Check no notifications were created
    const notifications = await db.select()
      .from(pushNotificationsTable)
      .execute();

    expect(notifications).toHaveLength(0);
  });
});