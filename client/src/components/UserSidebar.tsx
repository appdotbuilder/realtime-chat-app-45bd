import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import type { User } from '../../../server/src/schema';

interface UserSidebarProps {
  users: User[];
  currentUser: User;
}

export function UserSidebar({ users, currentUser }: UserSidebarProps) {
  // Filter out current user from the list
  const otherUsers = users.filter((user: User) => user.id !== currentUser.id);
  
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'offline':
      default:
        return 'Offline';
    }
  };

  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Users ({users.length})
        </h3>
      </div>
      
      <div className="space-y-2">
        {otherUsers.map((user: User) => (
          <div
            key={user.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="relative">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(user.status)}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.username}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user.email}
              </p>
            </div>
            
            <Badge 
              variant={user.status === 'online' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {getStatusText(user.status)}
            </Badge>
          </div>
        ))}
        
        {otherUsers.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No other users online</p>
            <p className="text-xs">Invite friends to join!</p>
          </div>
        )}
      </div>
      
      {/* Online users count */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Online now</span>
          <Badge variant="outline" className="text-green-600 border-green-600">
            {users.filter(u => u.status === 'online').length}
          </Badge>
        </div>
      </div>
    </div>
  );
}