import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input with all fields specified
const testInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  avatar_url: 'https://example.com/avatar.jpg',
  status: 'online'
};

// Test input with minimal required fields
const minimalInput: CreateUserInput = {
  username: 'minimaluser',
  email: 'minimal@example.com'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all fields', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(result.status).toEqual('online');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a user with minimal fields and apply defaults', async () => {
    const result = await createUser(minimalInput);

    expect(result.username).toEqual('minimaluser');
    expect(result.email).toEqual('minimal@example.com');
    expect(result.avatar_url).toBeNull();
    expect(result.status).toEqual('offline'); // Default status
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(users[0].status).toEqual('online');
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should enforce unique username constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create another user with same username but different email
    const duplicateUsernameInput: CreateUserInput = {
      username: 'testuser', // Same username
      email: 'different@example.com'
    };

    await expect(createUser(duplicateUsernameInput))
      .rejects
      .toThrow(/duplicate key value violates unique constraint/i);
  });

  it('should enforce unique email constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create another user with same email but different username
    const duplicateEmailInput: CreateUserInput = {
      username: 'differentuser',
      email: 'test@example.com' // Same email
    };

    await expect(createUser(duplicateEmailInput))
      .rejects
      .toThrow(/duplicate key value violates unique constraint/i);
  });

  it('should handle different status values correctly', async () => {
    const awayUser = await createUser({
      username: 'awayuser',
      email: 'away@example.com',
      status: 'away'
    });

    expect(awayUser.status).toEqual('away');

    const offlineUser = await createUser({
      username: 'offlineuser',
      email: 'offline@example.com',
      status: 'offline'
    });

    expect(offlineUser.status).toEqual('offline');
  });

  it('should handle null avatar_url correctly', async () => {
    const userWithNullAvatar = await createUser({
      username: 'nullavatar',
      email: 'null@example.com',
      avatar_url: null
    });

    expect(userWithNullAvatar.avatar_url).toBeNull();
  });

  it('should create multiple users with unique data', async () => {
    const user1 = await createUser({
      username: 'user1',
      email: 'user1@example.com'
    });

    const user2 = await createUser({
      username: 'user2',
      email: 'user2@example.com'
    });

    expect(user1.id).not.toEqual(user2.id);
    expect(user1.username).toEqual('user1');
    expect(user2.username).toEqual('user2');

    // Verify both are in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(2);
  });
});