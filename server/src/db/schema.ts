import { serial, text, pgTable, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userStatusEnum = pgEnum('user_status', ['online', 'offline', 'away']);
export const messageTypeEnum = pgEnum('message_type', ['text', 'image', 'file', 'system']);
export const roomRoleEnum = pgEnum('room_role', ['admin', 'moderator', 'member']);
export const notificationTypeEnum = pgEnum('notification_type', ['new_message', 'new_upload', 'new_comment', 'status_update', 'room_invite']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  avatar_url: text('avatar_url'),
  status: userStatusEnum('status').notNull().default('offline'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Chat rooms table
export const chatRoomsTable = pgTable('chat_rooms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  is_private: boolean('is_private').notNull().default(false),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Messages table
export const messagesTable = pgTable('messages', {
  id: serial('id').primaryKey(),
  room_id: integer('room_id').notNull().references(() => chatRoomsTable.id),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  content: text('content').notNull(),
  message_type: messageTypeEnum('message_type').notNull().default('text'),
  file_url: text('file_url'),
  reply_to_id: integer('reply_to_id'), // Self-reference will be handled in relations
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Room members table
export const roomMembersTable = pgTable('room_members', {
  id: serial('id').primaryKey(),
  room_id: integer('room_id').notNull().references(() => chatRoomsTable.id),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  role: roomRoleEnum('role').notNull().default('member'),
  joined_at: timestamp('joined_at').defaultNow().notNull(),
});

// Uploads table
export const uploadsTable = pgTable('uploads', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  filename: text('filename').notNull(),
  file_url: text('file_url').notNull(),
  file_size: integer('file_size').notNull(),
  file_type: text('file_type').notNull(),
  room_id: integer('room_id').references(() => chatRoomsTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Comments table (for uploads)
export const commentsTable = pgTable('comments', {
  id: serial('id').primaryKey(),
  upload_id: integer('upload_id').notNull().references(() => uploadsTable.id),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  content: text('content').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Push notifications table
export const pushNotificationsTable = pgTable('push_notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  type: notificationTypeEnum('type').notNull(),
  data: text('data'), // JSON string for additional data
  is_read: boolean('is_read').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  messages: many(messagesTable),
  roomMemberships: many(roomMembersTable),
  createdRooms: many(chatRoomsTable),
  uploads: many(uploadsTable),
  comments: many(commentsTable),
  notifications: many(pushNotificationsTable),
}));

export const chatRoomsRelations = relations(chatRoomsTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [chatRoomsTable.created_by],
    references: [usersTable.id],
  }),
  messages: many(messagesTable),
  members: many(roomMembersTable),
  uploads: many(uploadsTable),
}));

export const messagesRelations = relations(messagesTable, ({ one }) => ({
  room: one(chatRoomsTable, {
    fields: [messagesTable.room_id],
    references: [chatRoomsTable.id],
  }),
  user: one(usersTable, {
    fields: [messagesTable.user_id],
    references: [usersTable.id],
  }),
  replyTo: one(messagesTable, {
    fields: [messagesTable.reply_to_id],
    references: [messagesTable.id],
  }),
}));

export const roomMembersRelations = relations(roomMembersTable, ({ one }) => ({
  room: one(chatRoomsTable, {
    fields: [roomMembersTable.room_id],
    references: [chatRoomsTable.id],
  }),
  user: one(usersTable, {
    fields: [roomMembersTable.user_id],
    references: [usersTable.id],
  }),
}));

export const uploadsRelations = relations(uploadsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [uploadsTable.user_id],
    references: [usersTable.id],
  }),
  room: one(chatRoomsTable, {
    fields: [uploadsTable.room_id],
    references: [chatRoomsTable.id],
  }),
  comments: many(commentsTable),
}));

export const commentsRelations = relations(commentsTable, ({ one }) => ({
  upload: one(uploadsTable, {
    fields: [commentsTable.upload_id],
    references: [uploadsTable.id],
  }),
  user: one(usersTable, {
    fields: [commentsTable.user_id],
    references: [usersTable.id],
  }),
}));

export const pushNotificationsRelations = relations(pushNotificationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [pushNotificationsTable.user_id],
    references: [usersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type ChatRoom = typeof chatRoomsTable.$inferSelect;
export type NewChatRoom = typeof chatRoomsTable.$inferInsert;
export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;
export type RoomMember = typeof roomMembersTable.$inferSelect;
export type NewRoomMember = typeof roomMembersTable.$inferInsert;
export type Upload = typeof uploadsTable.$inferSelect;
export type NewUpload = typeof uploadsTable.$inferInsert;
export type Comment = typeof commentsTable.$inferSelect;
export type NewComment = typeof commentsTable.$inferInsert;
export type PushNotification = typeof pushNotificationsTable.$inferSelect;
export type NewPushNotification = typeof pushNotificationsTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  chatRooms: chatRoomsTable,
  messages: messagesTable,
  roomMembers: roomMembersTable,
  uploads: uploadsTable,
  comments: commentsTable,
  pushNotifications: pushNotificationsTable,
};