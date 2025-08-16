import { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCheck, Settings, Edit } from 'lucide-react';
import type { User, UpdateUserInput } from '../../../server/src/schema';

interface UserStatusManagerProps {
  currentUser: User;
  onUserUpdate: (updatedUser: User) => void;
}

export function UserStatusManager({ currentUser, onUserUpdate }: UserStatusManagerProps) {
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [userForm, setUserForm] = useState({
    username: currentUser.username,
    email: currentUser.email,
    avatar_url: currentUser.avatar_url || '',
    status: currentUser.status
  });

  // Update form when currentUser changes
  useEffect(() => {
    setUserForm({
      username: currentUser.username,
      email: currentUser.email,
      avatar_url: currentUser.avatar_url || '',
      status: currentUser.status
    });
  }, [currentUser]);

  // Update user status
  const handleStatusChange = async (newStatus: 'online' | 'away' | 'offline') => {
    try {
      const updateData: UpdateUserInput = {
        id: currentUser.id,
        status: newStatus
      };

      const updatedUser = await trpc.updateUser.mutate(updateData);
      onUserUpdate(updatedUser);
      
      // Create status update notification
      await trpc.createPushNotification.mutate({
        user_id: currentUser.id,
        title: '👤 Status Updated',
        body: `${currentUser.username} is now ${newStatus}`,
        type: 'status_update'
      });
    } catch (error) {
      console.error('Failed to update status via backend, updating locally:', error);
      
      // Update status locally when backend is not available
      const updatedUser: User = {
        ...currentUser,
        status: newStatus,
        updated_at: new Date()
      };
      onUserUpdate(updatedUser);
    }
  };

  // Update user profile
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const updateData: UpdateUserInput = {
        id: currentUser.id,
        username: userForm.username !== currentUser.username ? userForm.username : undefined,
        email: userForm.email !== currentUser.email ? userForm.email : undefined,
        avatar_url: userForm.avatar_url !== currentUser.avatar_url ? userForm.avatar_url || null : undefined,
        status: userForm.status !== currentUser.status ? userForm.status : undefined
      };

      const updatedUser = await trpc.updateUser.mutate(updateData);
      onUserUpdate(updatedUser);
      setShowSettingsDialog(false);
      
      // Create profile update notification
      await trpc.createPushNotification.mutate({
        user_id: currentUser.id,
        title: '✏️ Profile Updated',
        body: `${userForm.username} updated their profile`,
        type: 'status_update'
      });
    } catch (error) {
      console.error('Failed to update profile via backend, updating locally:', error);
      
      // Update profile locally when backend is not available
      const updatedUser: User = {
        ...currentUser,
        username: userForm.username,
        email: userForm.email,
        avatar_url: userForm.avatar_url || null,
        status: userForm.status,
        updated_at: new Date()
      };
      onUserUpdate(updatedUser);
      setShowSettingsDialog(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'offline':
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return '🟢 Online';
      case 'away':
        return '🟡 Away';
      case 'offline':
      default:
        return '⚪ Offline';
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* User avatar and info */}
      <div className="relative">
        {currentUser.avatar_url ? (
          <img
            src={currentUser.avatar_url}
            alt={currentUser.username}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-800 flex items-center justify-center text-white font-bold">
            {currentUser.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(currentUser.status)}`} />
      </div>
      
      <div className="flex-1">
        <p className="font-medium text-white">{currentUser.username}</p>
        
        {/* Status selector */}
        <Select value={currentUser.status} onValueChange={(value: 'online' | 'away' | 'offline') => handleStatusChange(value)}>
          <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent text-indigo-200 text-sm hover:text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="online">{getStatusLabel('online')}</SelectItem>
            <SelectItem value="away">{getStatusLabel('away')}</SelectItem>
            <SelectItem value="offline">{getStatusLabel('offline')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Settings button */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-white hover:bg-indigo-700">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Profile
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={userForm.username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUserForm((prev) => ({ ...prev, username: e.target.value }))
                }
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUserForm((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="avatar_url">Avatar URL (optional)</Label>
              <Input
                id="avatar_url"
                type="url"
                value={userForm.avatar_url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUserForm((prev) => ({ ...prev, avatar_url: e.target.value }))
                }
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={userForm.status}
                onValueChange={(value: 'online' | 'away' | 'offline') =>
                  setUserForm((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">{getStatusLabel('online')}</SelectItem>
                  <SelectItem value="away">{getStatusLabel('away')}</SelectItem>
                  <SelectItem value="offline">{getStatusLabel('offline')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}