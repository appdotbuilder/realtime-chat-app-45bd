import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatRoomsTable, messagesTable } from '../db/schema';
import { type GetRoomMessagesInput } from '../schema';
import { getRoomMessages } from '../handlers/get_room_messages';

describe('getRoomMessages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: any;
  let testRoom: any;

  const setupTestData = async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'online'
      })
      .returning()
      .execute();
    testUser = userResult[0];

    // Create test room
    const roomResult = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        description: 'A room for testing',
        is_private: false,
        created_by: testUser.id
      })
      .returning()
      .execute();
    testRoom = roomResult[0];

    return { testUser, testRoom };
  };

  it('should return messages from a room ordered by created_at desc', async () => {
    const { testUser, testRoom } = await setupTestData();

    // Create multiple test messages with different timestamps
    const message1 = await db.insert(messagesTable)
      .values({
        room_id: testRoom.id,
        user_id: testUser.id,
        content: 'First message',
        message_type: 'text'
      })
      .returning()
      .execute();

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const message2 = await db.insert(messagesTable)
      .values({
        room_id: testRoom.id,
        user_id: testUser.id,
        content: 'Second message',
        message_type: 'text'
      })
      .returning()
      .execute();

    const input: GetRoomMessagesInput = {
      room_id: testRoom.id
    };

    const result = await getRoomMessages(input);

    // Should return 2 messages
    expect(result).toHaveLength(2);

    // Should be ordered by created_at desc (newest first)
    expect(result[0].content).toBe('Second message');
    expect(result[1].content).toBe('First message');
    expect(result[0].created_at >= result[1].created_at).toBe(true);

    // Verify message fields
    expect(result[0].id).toBe(message2[0].id);
    expect(result[0].room_id).toBe(testRoom.id);
    expect(result[0].user_id).toBe(testUser.id);
    expect(result[0].message_type).toBe('text');
    expect(result[0].file_url).toBeNull();
    expect(result[0].reply_to_id).toBeNull();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should respect pagination with limit and offset', async () => {
    const { testUser, testRoom } = await setupTestData();

    // Create 5 test messages
    for (let i = 1; i <= 5; i++) {
      await db.insert(messagesTable)
        .values({
          room_id: testRoom.id,
          user_id: testUser.id,
          content: `Message ${i}`,
          message_type: 'text'
        })
        .execute();
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    // Test limit
    const limitInput: GetRoomMessagesInput = {
      room_id: testRoom.id,
      limit: 3
    };

    const limitResult = await getRoomMessages(limitInput);
    expect(limitResult).toHaveLength(3);

    // Test offset
    const offsetInput: GetRoomMessagesInput = {
      room_id: testRoom.id,
      limit: 2,
      offset: 2
    };

    const offsetResult = await getRoomMessages(offsetInput);
    expect(offsetResult).toHaveLength(2);

    // Verify the offset results are different from the first results
    expect(offsetResult[0].id).not.toBe(limitResult[0].id);
    expect(offsetResult[0].id).not.toBe(limitResult[1].id);
  });

  it('should use default pagination when not provided', async () => {
    const { testUser, testRoom } = await setupTestData();

    // Create one test message
    await db.insert(messagesTable)
      .values({
        room_id: testRoom.id,
        user_id: testUser.id,
        content: 'Test message',
        message_type: 'text'
      })
      .execute();

    const input: GetRoomMessagesInput = {
      room_id: testRoom.id
      // No limit or offset provided
    };

    const result = await getRoomMessages(input);

    // Should still work with default pagination
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Test message');
  });

  it('should return empty array for non-existent room', async () => {
    const input: GetRoomMessagesInput = {
      room_id: 999999 // Non-existent room ID
    };

    const result = await getRoomMessages(input);

    expect(result).toHaveLength(0);
  });

  it('should handle different message types correctly', async () => {
    const { testUser, testRoom } = await setupTestData();

    // Create messages of different types
    await db.insert(messagesTable)
      .values({
        room_id: testRoom.id,
        user_id: testUser.id,
        content: 'Text message',
        message_type: 'text'
      })
      .execute();

    await db.insert(messagesTable)
      .values({
        room_id: testRoom.id,
        user_id: testUser.id,
        content: 'Image shared',
        message_type: 'image',
        file_url: 'https://example.com/image.jpg'
      })
      .execute();

    await db.insert(messagesTable)
      .values({
        room_id: testRoom.id,
        user_id: testUser.id,
        content: 'System notification',
        message_type: 'system'
      })
      .execute();

    const input: GetRoomMessagesInput = {
      room_id: testRoom.id
    };

    const result = await getRoomMessages(input);

    expect(result).toHaveLength(3);

    // Find each message type in results
    const textMessage = result.find(m => m.message_type === 'text');
    const imageMessage = result.find(m => m.message_type === 'image');
    const systemMessage = result.find(m => m.message_type === 'system');

    expect(textMessage).toBeDefined();
    expect(textMessage!.content).toBe('Text message');
    expect(textMessage!.file_url).toBeNull();

    expect(imageMessage).toBeDefined();
    expect(imageMessage!.content).toBe('Image shared');
    expect(imageMessage!.file_url).toBe('https://example.com/image.jpg');

    expect(systemMessage).toBeDefined();
    expect(systemMessage!.content).toBe('System notification');
    expect(systemMessage!.file_url).toBeNull();
  });

  it('should handle reply messages correctly', async () => {
    const { testUser, testRoom } = await setupTestData();

    // Create original message
    const originalMessage = await db.insert(messagesTable)
      .values({
        room_id: testRoom.id,
        user_id: testUser.id,
        content: 'Original message',
        message_type: 'text'
      })
      .returning()
      .execute();

    // Create reply message
    await db.insert(messagesTable)
      .values({
        room_id: testRoom.id,
        user_id: testUser.id,
        content: 'Reply message',
        message_type: 'text',
        reply_to_id: originalMessage[0].id
      })
      .execute();

    const input: GetRoomMessagesInput = {
      room_id: testRoom.id
    };

    const result = await getRoomMessages(input);

    expect(result).toHaveLength(2);

    // Find the reply message
    const replyMessage = result.find(m => m.reply_to_id !== null);
    expect(replyMessage).toBeDefined();
    expect(replyMessage!.content).toBe('Reply message');
    expect(replyMessage!.reply_to_id).toBe(originalMessage[0].id);

    // Find the original message
    const originalMsg = result.find(m => m.reply_to_id === null);
    expect(originalMsg).toBeDefined();
    expect(originalMsg!.content).toBe('Original message');
  });

  it('should only return messages from specified room', async () => {
    const { testUser } = await setupTestData();

    // Create second room
    const room2Result = await db.insert(chatRoomsTable)
      .values({
        name: 'Second Room',
        description: 'Another test room',
        is_private: false,
        created_by: testUser.id
      })
      .returning()
      .execute();
    const testRoom2 = room2Result[0];

    // Create messages in both rooms
    await db.insert(messagesTable)
      .values({
        room_id: testRoom.id,
        user_id: testUser.id,
        content: 'Message in room 1',
        message_type: 'text'
      })
      .execute();

    await db.insert(messagesTable)
      .values({
        room_id: testRoom2.id,
        user_id: testUser.id,
        content: 'Message in room 2',
        message_type: 'text'
      })
      .execute();

    const input: GetRoomMessagesInput = {
      room_id: testRoom.id
    };

    const result = await getRoomMessages(input);

    // Should only return message from the specified room
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Message in room 1');
    expect(result[0].room_id).toBe(testRoom.id);
  });
});