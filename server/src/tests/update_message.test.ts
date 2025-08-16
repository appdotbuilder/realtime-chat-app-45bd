import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatRoomsTable, messagesTable } from '../db/schema';
import { type UpdateMessageInput } from '../schema';
import { updateMessage } from '../handlers/update_message';
import { eq } from 'drizzle-orm';

describe('updateMessage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update message content', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        status: 'online'
      })
      .returning()
      .execute();
    const user = userResult[0];

    // Create test chat room
    const roomResult = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room',
        description: 'A test room',
        is_private: false,
        created_by: user.id
      })
      .returning()
      .execute();
    const room = roomResult[0];

    // Create test message
    const messageResult = await db.insert(messagesTable)
      .values({
        room_id: room.id,
        user_id: user.id,
        content: 'Original message content',
        message_type: 'text'
      })
      .returning()
      .execute();
    const originalMessage = messageResult[0];

    // Update message
    const updateInput: UpdateMessageInput = {
      id: originalMessage.id,
      content: 'Updated message content'
    };

    const result = await updateMessage(updateInput);

    // Verify updated message
    expect(result.id).toEqual(originalMessage.id);
    expect(result.room_id).toEqual(room.id);
    expect(result.user_id).toEqual(user.id);
    expect(result.content).toEqual('Updated message content');
    expect(result.message_type).toEqual('text');
    expect(result.created_at).toEqual(originalMessage.created_at);
    expect(result.updated_at).not.toEqual(originalMessage.updated_at);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updated message to database', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser2',
        email: 'test2@example.com',
        status: 'online'
      })
      .returning()
      .execute();
    const user = userResult[0];

    // Create test chat room
    const roomResult = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room 2',
        description: 'Another test room',
        is_private: false,
        created_by: user.id
      })
      .returning()
      .execute();
    const room = roomResult[0];

    // Create test message
    const messageResult = await db.insert(messagesTable)
      .values({
        room_id: room.id,
        user_id: user.id,
        content: 'Message to be updated',
        message_type: 'text'
      })
      .returning()
      .execute();
    const originalMessage = messageResult[0];

    // Update message
    const updateInput: UpdateMessageInput = {
      id: originalMessage.id,
      content: 'This message has been updated'
    };

    const result = await updateMessage(updateInput);

    // Verify message was updated in database
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toEqual('This message has been updated');
    expect(messages[0].updated_at).toBeInstanceOf(Date);
    expect(messages[0].updated_at > originalMessage.updated_at).toBe(true);
  });

  it('should update message without changing content when content is undefined', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser3',
        email: 'test3@example.com',
        status: 'online'
      })
      .returning()
      .execute();
    const user = userResult[0];

    // Create test chat room
    const roomResult = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room 3',
        description: 'Yet another test room',
        is_private: false,
        created_by: user.id
      })
      .returning()
      .execute();
    const room = roomResult[0];

    // Create test message
    const messageResult = await db.insert(messagesTable)
      .values({
        room_id: room.id,
        user_id: user.id,
        content: 'Original content remains',
        message_type: 'text'
      })
      .returning()
      .execute();
    const originalMessage = messageResult[0];

    // Update message without content (should keep original content)
    const updateInput: UpdateMessageInput = {
      id: originalMessage.id
      // content is undefined
    };

    const result = await updateMessage(updateInput);

    // Verify content remains unchanged but updated_at is updated
    expect(result.content).toEqual('Original content remains');
    expect(result.updated_at).not.toEqual(originalMessage.updated_at);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when message does not exist', async () => {
    const updateInput: UpdateMessageInput = {
      id: 99999, // Non-existent message ID
      content: 'This should fail'
    };

    await expect(updateMessage(updateInput)).rejects.toThrow(/Message with id 99999 not found/i);
  });

  it('should preserve all other message fields when updating', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser4',
        email: 'test4@example.com',
        status: 'online'
      })
      .returning()
      .execute();
    const user = userResult[0];

    // Create test chat room
    const roomResult = await db.insert(chatRoomsTable)
      .values({
        name: 'Test Room 4',
        description: 'Test room for field preservation',
        is_private: false,
        created_by: user.id
      })
      .returning()
      .execute();
    const room = roomResult[0];

    // Create test message with file and reply
    const replyToMessageResult = await db.insert(messagesTable)
      .values({
        room_id: room.id,
        user_id: user.id,
        content: 'Original message to reply to',
        message_type: 'text'
      })
      .returning()
      .execute();
    const replyToMessage = replyToMessageResult[0];

    const messageResult = await db.insert(messagesTable)
      .values({
        room_id: room.id,
        user_id: user.id,
        content: 'Message with file and reply',
        message_type: 'image',
        file_url: 'https://example.com/image.jpg',
        reply_to_id: replyToMessage.id
      })
      .returning()
      .execute();
    const originalMessage = messageResult[0];

    // Add small delay to ensure updated_at will be different
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update message content
    const updateInput: UpdateMessageInput = {
      id: originalMessage.id,
      content: 'Updated content but keeping other fields'
    };

    const result = await updateMessage(updateInput);

    // Verify all fields are preserved except content and updated_at
    expect(result.id).toEqual(originalMessage.id);
    expect(result.room_id).toEqual(originalMessage.room_id);
    expect(result.user_id).toEqual(originalMessage.user_id);
    expect(result.content).toEqual('Updated content but keeping other fields');
    expect(result.message_type).toEqual('image');
    expect(result.file_url).toEqual('https://example.com/image.jpg');
    expect(result.reply_to_id).toEqual(replyToMessage.id);
    expect(result.created_at).toEqual(originalMessage.created_at);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalMessage.updated_at.getTime());
  });
});