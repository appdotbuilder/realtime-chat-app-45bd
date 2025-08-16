import { useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Reply, Edit3, FileText, Image } from 'lucide-react';
import type { ChatRoom, User, Message, CreateMessageInput } from '../../../server/src/schema';

interface ChatInterfaceProps {
  room: ChatRoom;
  currentUser: User;
  onNewMessage?: () => void;
}

export function ChatInterface({ room, currentUser, onNewMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load room messages
  const loadMessages = useCallback(async () => {
    try {
      const roomMessages = await trpc.getRoomMessages.query({
        room_id: room.id,
        limit: 50
      });
      setMessages(roomMessages);
    } catch (error) {
      console.error('Failed to load messages from backend:', error);
      // Create demo messages for the room
      const demoMessages: Message[] = [
        {
          id: 1,
          room_id: room.id,
          user_id: currentUser.id === 1 ? 2 : 1, // Make it from another user
          content: `Welcome to ${room.name}! 👋`,
          message_type: 'text',
          file_url: null,
          reply_to_id: null,
          created_at: new Date(Date.now() - 600000), // 10 minutes ago
          updated_at: new Date(Date.now() - 600000)
        },
        {
          id: 2,
          room_id: room.id,
          user_id: currentUser.id,
          content: 'Thanks! Great to be here! 😊',
          message_type: 'text',
          file_url: null,
          reply_to_id: 1,
          created_at: new Date(Date.now() - 300000), // 5 minutes ago
          updated_at: new Date(Date.now() - 300000)
        }
      ];
      setMessages(demoMessages);
    }
  }, [room.id, currentUser.id, room.name]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const messageData: CreateMessageInput = {
        room_id: room.id,
        user_id: currentUser.id,
        content: newMessage.trim(),
        message_type: 'text',
        reply_to_id: replyToMessage?.id || null
      };

      const createdMessage = await trpc.createMessage.mutate(messageData);
      setMessages((prev: Message[]) => [...prev, createdMessage]);
      setNewMessage('');
      setReplyToMessage(null);
      
      // Trigger notification refresh
      if (onNewMessage) {
        onNewMessage();
      }
    } catch (error) {
      console.error('Failed to send message to backend, adding locally:', error);
      
      // Add message locally when backend is not available
      const localMessage: Message = {
        id: Date.now(), // Use timestamp as ID for demo
        room_id: room.id,
        user_id: currentUser.id,
        content: newMessage.trim(),
        message_type: 'text',
        file_url: null,
        reply_to_id: replyToMessage?.id || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      setMessages((prev: Message[]) => [...prev, localMessage]);
      setNewMessage('');
      setReplyToMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(date));
  };

  // Format date for message grouping
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(date));
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, message) => {
    const date = formatDate(message.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  // Get message type icon
  const getMessageTypeIcon = (messageType: string) => {
    switch (messageType) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'file':
        return <FileText className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Room header */}
      <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-indigo-600 flex items-center justify-center text-white font-bold">
            #
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{room.name}</h2>
            {room.description && (
              <p className="text-sm text-gray-600">{room.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {Object.entries(groupedMessages).map(([date, dayMessages]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center justify-center mb-4">
                <div className="bg-gray-100 px-3 py-1 rounded-full">
                  <span className="text-sm text-gray-600 font-medium">{date}</span>
                </div>
              </div>

              {/* Messages for this date */}
              <div className="space-y-3">
                {dayMessages.map((message: Message) => {
                  const isCurrentUser = message.user_id === currentUser.id;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md ${isCurrentUser ? 'order-2' : 'order-1'}`}>
                        {/* Reply indicator */}
                        {message.reply_to_id && (
                          <div className="mb-1 px-3 py-1 bg-gray-50 rounded-lg border-l-3 border-gray-300">
                            <p className="text-xs text-gray-500">
                              Replying to message...
                            </p>
                          </div>
                        )}
                        
                        <div
                          className={`px-4 py-3 rounded-2xl shadow-sm ${
                            isCurrentUser
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {/* Message type indicator */}
                          {message.message_type !== 'text' && (
                            <div className="flex items-center gap-1 mb-2 opacity-75">
                              {getMessageTypeIcon(message.message_type)}
                              <span className="text-xs capitalize">{message.message_type}</span>
                            </div>
                          )}
                          
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          
                          {/* File URL for non-text messages */}
                          {message.file_url && (
                            <a
                              href={message.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs underline block mt-2 ${
                                isCurrentUser ? 'text-indigo-100' : 'text-indigo-600'
                              }`}
                            >
                              View file
                            </a>
                          )}
                        </div>
                        
                        <div className={`mt-1 flex items-center gap-2 text-xs text-gray-500 ${
                          isCurrentUser ? 'justify-end' : 'justify-start'
                        }`}>
                          <span>{formatTime(message.created_at)}</span>
                          {!isCurrentUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-gray-400 hover:text-gray-600"
                              onClick={() => setReplyToMessage(message)}
                            >
                              <Reply className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* User avatar */}
                      {!isCurrentUser && (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700 mr-3">
                          U
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          {messages.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">#</span>
              </div>
              <p className="text-lg font-medium mb-2">Welcome to #{room.name}! 🎉</p>
              <p className="text-sm">This is the beginning of your conversation.</p>
              <p className="text-sm">Send a message to get started!</p>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Message input */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {/* Reply indicator */}
        {replyToMessage && (
          <div className="mb-3 p-2 bg-white rounded-lg border-l-4 border-indigo-600 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Replying to:</p>
              <p className="text-sm text-gray-700 truncate">
                {replyToMessage.content.substring(0, 50)}...
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyToMessage(null)}
            >
              ×
            </Button>
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder={`Message #${room.name}...`}
              value={newMessage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
              disabled={isLoading}
              className="pr-12 py-3 rounded-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !newMessage.trim()}
            className="rounded-full p-3 bg-indigo-600 hover:bg-indigo-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}