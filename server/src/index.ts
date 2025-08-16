import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createUserInputSchema,
  updateUserInputSchema,
  createChatRoomInputSchema,
  createRoomMemberInputSchema,
  createMessageInputSchema,
  getRoomMessagesInputSchema,
  updateMessageInputSchema,
  createUploadInputSchema,
  createCommentInputSchema,
  createPushNotificationInputSchema,
  getUserNotificationsInputSchema,
  markNotificationReadInputSchema,
  getUserRoomsInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { updateUser } from './handlers/update_user';
import { createChatRoom } from './handlers/create_chat_room';
import { getUserRooms } from './handlers/get_user_rooms';
import { addRoomMember } from './handlers/add_room_member';
import { createMessage } from './handlers/create_message';
import { getRoomMessages } from './handlers/get_room_messages';
import { updateMessage } from './handlers/update_message';
import { createUpload } from './handlers/create_upload';
import { getUploads } from './handlers/get_uploads';
import { createComment } from './handlers/create_comment';
import { getUploadComments } from './handlers/get_upload_comments';
import { createPushNotification } from './handlers/create_push_notification';
import { getUserNotifications } from './handlers/get_user_notifications';
import { markNotificationRead } from './handlers/mark_notification_read';
import { getOnlineUsers } from './handlers/get_online_users';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  getUsers: publicProcedure
    .query(() => getUsers()),
  
  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),
  
  getOnlineUsers: publicProcedure
    .query(() => getOnlineUsers()),

  // Chat room management
  createChatRoom: publicProcedure
    .input(createChatRoomInputSchema)
    .mutation(({ input }) => createChatRoom(input)),
  
  getUserRooms: publicProcedure
    .input(getUserRoomsInputSchema)
    .query(({ input }) => getUserRooms(input)),
  
  addRoomMember: publicProcedure
    .input(createRoomMemberInputSchema)
    .mutation(({ input }) => addRoomMember(input)),

  // Message management
  createMessage: publicProcedure
    .input(createMessageInputSchema)
    .mutation(({ input }) => createMessage(input)),
  
  getRoomMessages: publicProcedure
    .input(getRoomMessagesInputSchema)
    .query(({ input }) => getRoomMessages(input)),
  
  updateMessage: publicProcedure
    .input(updateMessageInputSchema)
    .mutation(({ input }) => updateMessage(input)),

  // File uploads and comments
  createUpload: publicProcedure
    .input(createUploadInputSchema)
    .mutation(({ input }) => createUpload(input)),
  
  getUploads: publicProcedure
    .query(() => getUploads()),
  
  createComment: publicProcedure
    .input(createCommentInputSchema)
    .mutation(({ input }) => createComment(input)),
  
  getUploadComments: publicProcedure
    .input(z.object({ uploadId: z.number() }))
    .query(({ input }) => getUploadComments(input.uploadId)),

  // Push notifications
  createPushNotification: publicProcedure
    .input(createPushNotificationInputSchema)
    .mutation(({ input }) => createPushNotification(input)),
  
  getUserNotifications: publicProcedure
    .input(getUserNotificationsInputSchema)
    .query(({ input }) => getUserNotifications(input)),
  
  markNotificationRead: publicProcedure
    .input(markNotificationReadInputSchema)
    .mutation(({ input }) => markNotificationRead(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();