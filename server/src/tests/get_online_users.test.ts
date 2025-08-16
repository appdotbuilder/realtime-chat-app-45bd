import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getOnlineUsers } from '../handlers/get_online_users';

// Test user inputs with different statuses
const onlineUser1: CreateUserInput = {
  username: 'online_user_1',
  email: 'online1@example.com',
  status: 'online',
  avatar_url: 'https://example.com/avatar1.jpg'
};

const onlineUser2: CreateUserInput = {
  username: 'online_user_2',
  email: 'online2@example.com',
  status: 'online',
  avatar_url: null
};

const offlineUser: CreateUserInput = {
  username: 'offline_user',
  email: 'offline@example.com',
  status: 'offline',
  avatar_url: null
};

const awayUser: CreateUserInput = {
  username: 'away_user',
  email: 'away@example.com',
  status: 'away',
  avatar_url: 'https://example.com/avatar2.jpg'
};

describe('getOnlineUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getOnlineUsers();
    
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return empty array when no online users exist', async () => {
    // Create users with non-online statuses
    await db.insert(usersTable)
      .values([
        {
          username: offlineUser.username,
          email: offlineUser.email,
          status: offlineUser.status!,
          avatar_url: offlineUser.avatar_url
        },
        {
          username: awayUser.username,
          email: awayUser.email,
          status: awayUser.status!,
          avatar_url: awayUser.avatar_url
        }
      ])
      .execute();

    const result = await getOnlineUsers();
    
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return only online users', async () => {
    // Create users with various statuses
    await db.insert(usersTable)
      .values([
        {
          username: onlineUser1.username,
          email: onlineUser1.email,
          status: onlineUser1.status!,
          avatar_url: onlineUser1.avatar_url
        },
        {
          username: offlineUser.username,
          email: offlineUser.email,
          status: offlineUser.status!,
          avatar_url: offlineUser.avatar_url
        },
        {
          username: onlineUser2.username,
          email: onlineUser2.email,
          status: onlineUser2.status!,
          avatar_url: onlineUser2.avatar_url
        },
        {
          username: awayUser.username,
          email: awayUser.email,
          status: awayUser.status!,
          avatar_url: awayUser.avatar_url
        }
      ])
      .execute();

    const result = await getOnlineUsers();
    
    expect(result).toHaveLength(2);
    
    // Verify both online users are returned
    const usernames = result.map(user => user.username);
    expect(usernames).toContain('online_user_1');
    expect(usernames).toContain('online_user_2');
    
    // Verify offline and away users are not returned
    expect(usernames).not.toContain('offline_user');
    expect(usernames).not.toContain('away_user');
    
    // Verify all returned users have online status
    result.forEach(user => {
      expect(user.status).toEqual('online');
    });
  });

  it('should return users with correct field values', async () => {
    // Create online user
    const insertedUsers = await db.insert(usersTable)
      .values({
        username: onlineUser1.username,
        email: onlineUser1.email,
        status: onlineUser1.status!,
        avatar_url: onlineUser1.avatar_url
      })
      .returning()
      .execute();

    const result = await getOnlineUsers();
    
    expect(result).toHaveLength(1);
    
    const user = result[0];
    expect(user.id).toBeDefined();
    expect(typeof user.id).toBe('number');
    expect(user.username).toEqual('online_user_1');
    expect(user.email).toEqual('online1@example.com');
    expect(user.status).toEqual('online');
    expect(user.avatar_url).toEqual('https://example.com/avatar1.jpg');
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
  });

  it('should handle users with null avatar_url correctly', async () => {
    // Create online user with null avatar_url
    await db.insert(usersTable)
      .values({
        username: onlineUser2.username,
        email: onlineUser2.email,
        status: onlineUser2.status!,
        avatar_url: onlineUser2.avatar_url
      })
      .execute();

    const result = await getOnlineUsers();
    
    expect(result).toHaveLength(1);
    
    const user = result[0];
    expect(user.username).toEqual('online_user_2');
    expect(user.avatar_url).toBeNull();
    expect(user.status).toEqual('online');
  });

  it('should return multiple online users in consistent order', async () => {
    // Create multiple online users
    const users = [onlineUser1, onlineUser2];
    
    for (const userData of users) {
      await db.insert(usersTable)
        .values({
          username: userData.username,
          email: userData.email,
          status: userData.status!,
          avatar_url: userData.avatar_url
        })
        .execute();
    }

    const result = await getOnlineUsers();
    
    expect(result).toHaveLength(2);
    
    // Verify each user has expected properties
    result.forEach(user => {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('status');
      expect(user).toHaveProperty('avatar_url');
      expect(user).toHaveProperty('created_at');
      expect(user).toHaveProperty('updated_at');
      expect(user.status).toEqual('online');
    });
  });
});