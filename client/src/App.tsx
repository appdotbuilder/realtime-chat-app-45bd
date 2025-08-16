import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { ChatInterface } from '@/components/ChatInterface';
import { UserSidebar } from '@/components/UserSidebar';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { UploadManager } from '@/components/UploadManager';
import { UserStatusManager } from '@/components/UserStatusManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Bell, MessageCircle, Users, Upload, UserPlus, Info } from 'lucide-react';
import type { User, ChatRoom, PushNotification } from '../../server/src/schema';

function App() {
  // Current user state - in a real app, this would come from authentication
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userRooms, setUserRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewRoomDialog, setShowNewRoomDialog] = useState(false);
  const [showUploadManager, setShowUploadManager] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: ''
  });

  // Demo data for when backend is not available
  const createDemoData = () => {
    const demoUsers: User[] = [
      {
        id: 1,
        username: 'Alice',
        email: 'alice@demo.com',
        avatar_url: null,
        status: 'online',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        username: 'Bob',
        email: 'bob@demo.com',
        avatar_url: null,
        status: 'away',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        username: 'Charlie',
        email: 'charlie@demo.com',
        avatar_url: null,
        status: 'offline',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    const demoRooms: ChatRoom[] = [
      {
        id: 1,
        name: 'General',
        description: 'General discussion room',
        is_private: false,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        name: 'Random',
        description: 'Random conversations',
        is_private: false,
        created_by: 2,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    return { users: demoUsers, rooms: demoRooms };
  };

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const usersResult = await trpc.getUsers.query();
      setUsers(usersResult);
      
      // Set first user as current user for demo purposes
      // NOTE: This is stub behavior - in a real app, user would be authenticated
      if (usersResult.length > 0 && !currentUser) {
        setCurrentUser(usersResult[0]);
      }
    } catch (error) {
      console.error('Failed to load users from backend, using demo data:', error);
      
      // Use demo data when backend is not available
      const { users: demoUsers, rooms: demoRooms } = createDemoData();
      setUsers(demoUsers);
      setUserRooms(demoRooms);
      setIsDemoMode(true);
      
      // Set first demo user as current user
      if (!currentUser && demoUsers.length > 0) {
        setCurrentUser(demoUsers[0]);
        setActiveRoomId(demoRooms[0]?.id || null);
      }
    }
  }, [currentUser]);

  // Load user's rooms when current user changes
  const loadUserRooms = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const rooms = await trpc.getUserRooms.query({ user_id: currentUser.id });
      setUserRooms(rooms);
      
      // Set first room as active if none selected
      if (rooms.length > 0 && !activeRoomId) {
        setActiveRoomId(rooms[0].id);
      }
    } catch (error) {
      console.error('Failed to load user rooms from backend:', error);
      // Don't load demo rooms again if they're already loaded from loadData
      if (userRooms.length === 0) {
        const { rooms: demoRooms } = createDemoData();
        setUserRooms(demoRooms);
        if (!activeRoomId && demoRooms.length > 0) {
          setActiveRoomId(demoRooms[0].id);
        }
      }
    }
  }, [currentUser, activeRoomId, userRooms.length]);

  // Load user notifications
  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const notificationsResult = await trpc.getUserNotifications.query({ 
        user_id: currentUser.id,
        limit: 20 
      });
      setNotifications(notificationsResult);
    } catch (error) {
      console.error('Failed to load notifications from backend:', error);
      // Create some demo notifications
      const demoNotifications: PushNotification[] = [
        {
          id: 1,
          user_id: currentUser.id,
          title: '🎉 Welcome to ChatApp!',
          body: 'Start chatting with your friends',
          type: 'status_update',
          data: null,
          is_read: false,
          created_at: new Date()
        },
        {
          id: 2,
          user_id: currentUser.id,
          title: '💬 Demo Message',
          body: 'This is a demo notification',
          type: 'new_message',
          data: null,
          is_read: true,
          created_at: new Date(Date.now() - 300000) // 5 minutes ago
        }
      ];
      setNotifications(demoNotifications);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadUserRooms();
  }, [loadUserRooms]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Create new user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.username.trim() || !newUserForm.email.trim()) return;

    try {
      const newUser = await trpc.createUser.mutate({
        username: newUserForm.username,
        email: newUserForm.email,
        status: 'online'
      });
      
      setUsers((prev: User[]) => [...prev, newUser]);
      setCurrentUser(newUser);
      setNewUserForm({ username: '', email: '' });
      setShowCreateUserDialog(false);
    } catch (error) {
      console.error('Failed to create user via backend, creating locally:', error);
      
      // Create user locally when backend is not available
      const localUser: User = {
        id: Math.max(...users.map(u => u.id), 0) + 1,
        username: newUserForm.username,
        email: newUserForm.email,
        avatar_url: null,
        status: 'online',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      setUsers((prev: User[]) => [...prev, localUser]);
      setCurrentUser(localUser);
      setNewUserForm({ username: '', email: '' });
      setShowCreateUserDialog(false);
      
      // Create demo rooms for new user
      if (userRooms.length === 0) {
        const { rooms: demoRooms } = createDemoData();
        setUserRooms(demoRooms);
        setActiveRoomId(demoRooms[0]?.id || null);
      }
    }
  };

  // Create new chat room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newRoomName.trim()) return;

    try {
      const newRoom = await trpc.createChatRoom.mutate({
        name: newRoomName,
        description: newRoomDescription || null,
        is_private: false,
        created_by: currentUser.id
      });
      
      // Add creator as room member
      await trpc.addRoomMember.mutate({
        room_id: newRoom.id,
        user_id: currentUser.id,
        role: 'admin'
      });
      
      setUserRooms((prev: ChatRoom[]) => [...prev, newRoom]);
      setActiveRoomId(newRoom.id);
      setNewRoomName('');
      setNewRoomDescription('');
      setShowNewRoomDialog(false);
    } catch (error) {
      console.error('Failed to create room via backend, creating locally:', error);
      
      // Create room locally when backend is not available
      const localRoom: ChatRoom = {
        id: Math.max(...userRooms.map(r => r.id), 0) + 1,
        name: newRoomName,
        description: newRoomDescription || null,
        is_private: false,
        created_by: currentUser.id,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      setUserRooms((prev: ChatRoom[]) => [...prev, localRoom]);
      setActiveRoomId(localRoom.id);
      setNewRoomName('');
      setNewRoomDescription('');
      setShowNewRoomDialog(false);
    }
  };

  // Mark notification as read
  const markNotificationRead = async (notificationId: number) => {
    try {
      await trpc.markNotificationRead.mutate({ id: notificationId });
      setNotifications((prev: PushNotification[]) =>
        prev.map((notification: PushNotification) =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;
  const activeRoom = userRooms.find(room => room.id === activeRoomId);

  // Show user creation if no current user and no users exist
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <MessageCircle className="h-16 w-16 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to ChatApp! 🎉</h2>
          
          {users.length === 0 ? (
            <div>
              <p className="text-gray-600 mb-4">Get started by creating your user account</p>
              <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Your Account</DialogTitle>
                    <DialogDescription>
                      Join the chat by creating your user account
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <Input
                      placeholder="Your username"
                      value={newUserForm.username}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewUserForm((prev) => ({ ...prev, username: e.target.value }))
                      }
                      required
                    />
                    <Input
                      type="email"
                      placeholder="Your email"
                      value={newUserForm.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewUserForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      required
                    />
                    <Button type="submit" className="w-full">
                      Create Account & Join Chat
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">Select an existing user or create a new one</p>
              <div className="space-y-2">
                {users.slice(0, 3).map((user: User) => (
                  <Button
                    key={user.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setCurrentUser(user)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{user.username}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </Button>
                ))}
                
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowCreateUserDialog(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create New Account
                </Button>
              </div>
              
              {/* Hidden create user dialog for existing users case */}
              <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Account</DialogTitle>
                    <DialogDescription>
                      Create a new user account to join the chat
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <Input
                      placeholder="Your username"
                      value={newUserForm.username}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewUserForm((prev) => ({ ...prev, username: e.target.value }))
                      }
                      required
                    />
                    <Input
                      type="email"
                      placeholder="Your email"
                      value={newUserForm.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewUserForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      required
                    />
                    <Button type="submit" className="w-full">
                      Create Account & Join Chat
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2">
          <div className="flex items-center gap-2 text-yellow-800">
            <Info className="h-4 w-4" />
            <span className="text-sm">
              <strong>Demo Mode:</strong> Backend not available - using local data. All features work but data won't persist.
            </span>
          </div>
        </div>
      )}
      
      <div className="flex-1 flex">
        {/* Sidebar with user list */}
      <div className="w-80 bg-white border-r border-gray-200 shadow-lg">
        <div className="p-4 border-b border-gray-200 bg-indigo-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">💬 ChatApp</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-indigo-700"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationsCount > 0 && (
                  <Badge className="ml-1 bg-red-500 text-white text-xs">
                    {unreadNotificationsCount}
                  </Badge>
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-indigo-700"
                onClick={() => setShowUploadManager(!showUploadManager)}
              >
                <Upload className="h-4 w-4" />
              </Button>
              
              <Dialog open={showNewRoomDialog} onOpenChange={setShowNewRoomDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-indigo-700">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Room</DialogTitle>
                    <DialogDescription>
                      Create a new chat room to start conversations with other users.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateRoom} className="space-y-4">
                    <Input
                      placeholder="Room name"
                      value={newRoomName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRoomName(e.target.value)}
                      required
                    />
                    <Input
                      placeholder="Room description (optional)"
                      value={newRoomDescription}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRoomDescription(e.target.value)}
                    />
                    <Button type="submit" className="w-full">
                      Create Room
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <UserStatusManager
            currentUser={currentUser}
            onUserUpdate={(updatedUser: User) => {
              setCurrentUser(updatedUser);
              // Refresh users list to reflect the change
              loadData();
            }}
          />
        </div>

        {/* Room list */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Chat Rooms ({userRooms.length})
            </h3>
          </div>
          <div className="space-y-1">
            {userRooms.map((room: ChatRoom) => (
              <button
                key={room.id}
                onClick={() => setActiveRoomId(room.id)}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  activeRoomId === room.id
                    ? 'bg-indigo-100 border-l-4 border-indigo-600 text-indigo-900'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                    #
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{room.name}</p>
                    {room.description && (
                      <p className="text-xs text-gray-500 truncate">{room.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
            
            {userRooms.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No chat rooms yet</p>
                <p className="text-xs">Create one to get started!</p>
              </div>
            )}
          </div>
        </div>

        {/* Users list */}
        <UserSidebar users={users} currentUser={currentUser} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {showUploadManager ? (
          <div className="flex-1 bg-white">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Upload className="h-6 w-6 text-indigo-600" />
                  File Manager
                </h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowUploadManager(false)}
                >
                  Back to Chat
                </Button>
              </div>
            </div>
            <div className="p-6">
              <UploadManager currentUser={currentUser} roomId={activeRoomId || undefined} />
            </div>
          </div>
        ) : activeRoom ? (
          <ChatInterface
            room={activeRoom}
            currentUser={currentUser}
            onNewMessage={loadNotifications}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <MessageCircle className="h-24 w-24 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to ChatApp! 🎉</h3>
              <p className="text-gray-600 mb-4">Select a room to start chatting, or create a new one.</p>
              <div className="space-y-2">
                <Button onClick={() => setShowNewRoomDialog(true)} className="w-full">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Create Your First Room
                </Button>
                <Button variant="outline" onClick={() => setShowUploadManager(true)} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  View File Manager
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notifications panel */}
      {showNotifications && (
        <NotificationsPanel
          notifications={notifications}
          onMarkAsRead={markNotificationRead}
          onClose={() => setShowNotifications(false)}
        />
      )}
      </div>
    </div>
  );
}

export default App;