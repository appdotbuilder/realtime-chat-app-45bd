import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { X, Bell, MessageCircle, Upload, MessageSquare, UserCheck, Users } from 'lucide-react';
import type { PushNotification } from '../../../server/src/schema';

interface NotificationsPanelProps {
  notifications: PushNotification[];
  onMarkAsRead: (notificationId: number) => void;
  onClose: () => void;
}

export function NotificationsPanel({ 
  notifications, 
  onMarkAsRead, 
  onClose 
}: NotificationsPanelProps) {
  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_message':
        return <MessageCircle className="h-4 w-4 text-blue-600" />;
      case 'new_upload':
        return <Upload className="h-4 w-4 text-green-600" />;
      case 'new_comment':
        return <MessageSquare className="h-4 w-4 text-purple-600" />;
      case 'status_update':
        return <UserCheck className="h-4 w-4 text-yellow-600" />;
      case 'room_invite':
        return <Users className="h-4 w-4 text-indigo-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get color scheme for notification type
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'new_message':
        return 'border-l-blue-500 bg-blue-50';
      case 'new_upload':
        return 'border-l-green-500 bg-green-50';
      case 'new_comment':
        return 'border-l-purple-500 bg-purple-50';
      case 'status_update':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'room_invite':
        return 'border-l-indigo-500 bg-indigo-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  // Format notification time
  const formatNotificationTime = (date: Date) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}d ago`;
    }
  };

  // Group notifications by read status
  const unreadNotifications = notifications.filter(n => !n.is_read);
  const readNotifications = notifications.filter(n => n.is_read);

  return (
    <div className="w-80 bg-white border-l border-gray-200 shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            {unreadNotifications.length > 0 && (
              <Badge className="bg-red-500 text-white">
                {unreadNotifications.length}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Notifications list */}
      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="p-4 space-y-4">
          {/* Unread notifications */}
          {unreadNotifications.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                Unread ({unreadNotifications.length})
              </h3>
              <div className="space-y-2">
                {unreadNotifications.map((notification: PushNotification) => (
                  <Card
                    key={notification.id}
                    className={`border-l-4 ${getNotificationColor(notification.type)} cursor-pointer hover:shadow-md transition-shadow`}
                    onClick={() => onMarkAsRead(notification.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-2">
                            {notification.body}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {formatNotificationTime(notification.created_at)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {notification.type.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Read notifications */}
          {readNotifications.length > 0 && (
            <div className={unreadNotifications.length > 0 ? 'pt-4 border-t border-gray-200' : ''}>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                Earlier
              </h3>
              <div className="space-y-2">
                {readNotifications.slice(0, 10).map((notification: PushNotification) => (
                  <Card
                    key={notification.id}
                    className="border-gray-200 opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5 opacity-60">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-700 mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                            {notification.body}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                              {formatNotificationTime(notification.created_at)}
                            </span>
                            <Badge variant="secondary" className="text-xs opacity-60">
                              {notification.type.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {notifications.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
              <p className="text-gray-500 text-sm">
                You'll see notifications here when there are new messages, uploads, or updates.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}