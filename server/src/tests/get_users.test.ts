import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers } from '../handlers/get_users';

// Test data
const testUsers: CreateUserInput[] = [
  {
    username: 'alice',
    email: 'alice@example.com',
    avatar_url: 'https://example.com/alice.jpg',
    status: 'online'
  },
  {
    username: 'bob',
    email: 'bob@example.com',
    avatar_url: null,
    status: 'offline'
  },
  {
    username: 'charlie',
    email: 'charlie@example.com',
    status: 'away'
  }
];

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();

    expect(result).toEqual([]);
  });

  it('should return all users from database', async () => {
    // Create test users
    await db.insert(usersTable)
      .values(testUsers)
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);
    
    // Verify user data
    const alice = result.find(u => u.username === 'alice');
    expect(alice).toBeDefined();
    expect(alice?.email).toEqual('alice@example.com');
    expect(alice?.avatar_url).toEqual('https://example.com/alice.jpg');
    expect(alice?.status).toEqual('online');
    expect(alice?.id).toBeDefined();
    expect(alice?.created_at).toBeInstanceOf(Date);
    expect(alice?.updated_at).toBeInstanceOf(Date);

    const bob = result.find(u => u.username === 'bob');
    expect(bob).toBeDefined();
    expect(bob?.email).toEqual('bob@example.com');
    expect(bob?.avatar_url).toBeNull();
    expect(bob?.status).toEqual('offline');

    const charlie = result.find(u => u.username === 'charlie');
    expect(charlie).toBeDefined();
    expect(charlie?.email).toEqual('charlie@example.com');
    expect(charlie?.avatar_url).toBeNull(); // Default value
    expect(charlie?.status).toEqual('away');
  });

  it('should return users with all required fields', async () => {
    // Create a single test user
    await db.insert(usersTable)
      .values([testUsers[0]])
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    const user = result[0];

    // Verify all required fields are present
    expect(user.id).toBeDefined();
    expect(typeof user.id).toBe('number');
    expect(user.username).toBeDefined();
    expect(typeof user.username).toBe('string');
    expect(user.email).toBeDefined();
    expect(typeof user.email).toBe('string');
    expect(user.status).toBeDefined();
    expect(['online', 'offline', 'away']).toContain(user.status);
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
  });

  it('should return users with different statuses correctly', async () => {
    // Create users with different statuses
    await db.insert(usersTable)
      .values(testUsers)
      .execute();

    const result = await getUsers();

    const statuses = result.map(u => u.status);
    expect(statuses).toContain('online');
    expect(statuses).toContain('offline');
    expect(statuses).toContain('away');
  });

  it('should handle nullable avatar_url field correctly', async () => {
    // Create users with and without avatar URLs
    await db.insert(usersTable)
      .values(testUsers)
      .execute();

    const result = await getUsers();

    const withAvatar = result.find(u => u.username === 'alice');
    const withoutAvatar = result.find(u => u.username === 'bob');

    expect(withAvatar?.avatar_url).toEqual('https://example.com/alice.jpg');
    expect(withoutAvatar?.avatar_url).toBeNull();
  });
});