import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  avatar_url: z.string().nullable(),
  status: z.enum(['online', 'offline', 'away']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Chat room schema
export const chatRoomSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  is_private: z.boolean(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ChatRoom = z.infer<typeof chatRoomSchema>;

// Message schema
export const messageSchema = z.object({
  id: z.number(),
  room_id: z.number(),
  user_id: z.number(),
  content: z.string(),
  message_type: z.enum(['text', 'image', 'file', 'system']),
  file_url: z.string().nullable(),
  reply_to_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Message = z.infer<typeof messageSchema>;

// Room members schema
export const roomMemberSchema = z.object({
  id: z.number(),
  room_id: z.number(),
  user_id: z.number(),
  role: z.enum(['admin', 'moderator', 'member']),
  joined_at: z.coerce.date()
});

export type RoomMember = z.infer<typeof roomMemberSchema>;

// Upload schema
export const uploadSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  filename: z.string(),
  file_url: z.string(),
  file_size: z.number(),
  file_type: z.string(),
  room_id: z.number().nullable(),
  created_at: z.coerce.date()
});

export type Upload = z.infer<typeof uploadSchema>;

// Comment schema (for uploads)
export const commentSchema = z.object({
  id: z.number(),
  upload_id: z.number(),
  user_id: z.number(),
  content: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Comment = z.infer<typeof commentSchema>;

// Push notification schema
export const pushNotificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  body: z.string(),
  type: z.enum(['new_message', 'new_upload', 'new_comment', 'status_update', 'room_invite']),
  data: z.string().nullable(), // JSON string for additional data
  is_read: z.boolean(),
  created_at: z.coerce.date()
});

export type PushNotification = z.infer<typeof pushNotificationSchema>;

// Input schemas for creating entities

export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  avatar_url: z.string().nullable().optional(),
  status: z.enum(['online', 'offline', 'away']).optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createChatRoomInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  is_private: z.boolean().optional(),
  created_by: z.number()
});

export type CreateChatRoomInput = z.infer<typeof createChatRoomInputSchema>;

export const createMessageInputSchema = z.object({
  room_id: z.number(),
  user_id: z.number(),
  content: z.string().min(1),
  message_type: z.enum(['text', 'image', 'file', 'system']).optional(),
  file_url: z.string().nullable().optional(),
  reply_to_id: z.number().nullable().optional()
});

export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;

export const createRoomMemberInputSchema = z.object({
  room_id: z.number(),
  user_id: z.number(),
  role: z.enum(['admin', 'moderator', 'member']).optional()
});

export type CreateRoomMemberInput = z.infer<typeof createRoomMemberInputSchema>;

export const createUploadInputSchema = z.object({
  user_id: z.number(),
  filename: z.string(),
  file_url: z.string(),
  file_size: z.number().positive(),
  file_type: z.string(),
  room_id: z.number().nullable().optional()
});

export type CreateUploadInput = z.infer<typeof createUploadInputSchema>;

export const createCommentInputSchema = z.object({
  upload_id: z.number(),
  user_id: z.number(),
  content: z.string().min(1)
});

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;

export const createPushNotificationInputSchema = z.object({
  user_id: z.number(),
  title: z.string(),
  body: z.string(),
  type: z.enum(['new_message', 'new_upload', 'new_comment', 'status_update', 'room_invite']),
  data: z.string().nullable().optional()
});

export type CreatePushNotificationInput = z.infer<typeof createPushNotificationInputSchema>;

// Update schemas

export const updateUserInputSchema = z.object({
  id: z.number(),
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  avatar_url: z.string().nullable().optional(),
  status: z.enum(['online', 'offline', 'away']).optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const updateMessageInputSchema = z.object({
  id: z.number(),
  content: z.string().min(1).optional()
});

export type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>;

export const markNotificationReadInputSchema = z.object({
  id: z.number()
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadInputSchema>;

// Query input schemas

export const getRoomMessagesInputSchema = z.object({
  room_id: z.number(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetRoomMessagesInput = z.infer<typeof getRoomMessagesInputSchema>;

export const getUserNotificationsInputSchema = z.object({
  user_id: z.number(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetUserNotificationsInput = z.infer<typeof getUserNotificationsInputSchema>;

export const getUserRoomsInputSchema = z.object({
  user_id: z.number()
});

export type GetUserRoomsInput = z.infer<typeof getUserRoomsInputSchema>;