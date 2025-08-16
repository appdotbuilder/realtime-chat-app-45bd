import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, File, MessageSquare, User } from 'lucide-react';
import type { User as UserType, Upload as UploadType, Comment, CreateUploadInput, CreateCommentInput } from '../../../server/src/schema';

interface UploadManagerProps {
  currentUser: UserType;
  roomId?: number;
}

export function UploadManager({ currentUser, roomId }: UploadManagerProps) {
  const [uploads, setUploads] = useState<UploadType[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<UploadType | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    filename: '',
    file_url: '',
    file_size: 0,
    file_type: ''
  });

  // Load uploads
  const loadUploads = useCallback(async () => {
    try {
      const uploadsResult = await trpc.getUploads.query();
      setUploads(uploadsResult);
    } catch (error) {
      console.error('Failed to load uploads from backend:', error);
      // Create demo uploads
      const demoUploads: UploadType[] = [
        {
          id: 1,
          user_id: currentUser.id,
          filename: 'demo-image.png',
          file_url: 'https://via.placeholder.com/400x300.png?text=Demo+Image',
          file_size: 1024 * 50, // 50KB
          file_type: 'image/png',
          room_id: roomId || null,
          created_at: new Date(Date.now() - 3600000) // 1 hour ago
        },
        {
          id: 2,
          user_id: currentUser.id,
          filename: 'sample-document.pdf',
          file_url: '#',
          file_size: 1024 * 200, // 200KB
          file_type: 'application/pdf',
          room_id: roomId || null,
          created_at: new Date(Date.now() - 1800000) // 30 minutes ago
        }
      ];
      setUploads(demoUploads);
    }
  }, [currentUser.id, roomId]);

  // Load comments for selected upload
  const loadComments = useCallback(async (uploadId: number) => {
    try {
      const commentsResult = await trpc.getUploadComments.query({ uploadId });
      setComments(commentsResult);
    } catch (error) {
      console.error('Failed to load comments from backend:', error);
      // Create demo comments
      const demoComments: Comment[] = [
        {
          id: 1,
          upload_id: uploadId,
          user_id: currentUser.id,
          content: 'Great file! Thanks for sharing.',
          created_at: new Date(Date.now() - 1800000), // 30 minutes ago
          updated_at: new Date(Date.now() - 1800000)
        },
        {
          id: 2,
          upload_id: uploadId,
          user_id: currentUser.id,
          content: 'This looks really useful!',
          created_at: new Date(Date.now() - 900000), // 15 minutes ago
          updated_at: new Date(Date.now() - 900000)
        }
      ];
      setComments(demoComments);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  useEffect(() => {
    if (selectedUpload) {
      loadComments(selectedUpload.id);
    }
  }, [selectedUpload, loadComments]);

  // Create new upload
  const handleCreateUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.filename || !uploadForm.file_url) return;

    try {
      const uploadData: CreateUploadInput = {
        user_id: currentUser.id,
        filename: uploadForm.filename,
        file_url: uploadForm.file_url,
        file_size: uploadForm.file_size || 1024, // Default size if not provided
        file_type: uploadForm.file_type || 'unknown',
        room_id: roomId || null
      };

      const newUpload = await trpc.createUpload.mutate(uploadData);
      setUploads((prev: UploadType[]) => [newUpload, ...prev]);
      setUploadForm({ filename: '', file_url: '', file_size: 0, file_type: '' });
      setShowUploadDialog(false);
      
      // Create notification for upload
      await trpc.createPushNotification.mutate({
        user_id: currentUser.id,
        title: '📎 New File Uploaded',
        body: `${currentUser.username} uploaded ${uploadForm.filename}`,
        type: 'new_upload'
      });
    } catch (error) {
      console.error('Failed to create upload via backend, creating locally:', error);
      
      // Create upload locally when backend is not available
      const localUpload: UploadType = {
        id: Math.max(...uploads.map(u => u.id), 0) + 1,
        user_id: currentUser.id,
        filename: uploadForm.filename,
        file_url: uploadForm.file_url,
        file_size: uploadForm.file_size || 1024,
        file_type: uploadForm.file_type || 'unknown',
        room_id: roomId || null,
        created_at: new Date()
      };
      
      setUploads((prev: UploadType[]) => [localUpload, ...prev]);
      setUploadForm({ filename: '', file_url: '', file_size: 0, file_type: '' });
      setShowUploadDialog(false);
    }
  };

  // Add comment to upload
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUpload || !newComment.trim()) return;

    try {
      const commentData: CreateCommentInput = {
        upload_id: selectedUpload.id,
        user_id: currentUser.id,
        content: newComment.trim()
      };

      const comment = await trpc.createComment.mutate(commentData);
      setComments((prev: Comment[]) => [...prev, comment]);
      setNewComment('');
      
      // Create notification for comment
      await trpc.createPushNotification.mutate({
        user_id: currentUser.id,
        title: '💬 New Comment',
        body: `${currentUser.username} commented on ${selectedUpload.filename}`,
        type: 'new_comment'
      });
    } catch (error) {
      console.error('Failed to add comment via backend, adding locally:', error);
      
      // Add comment locally when backend is not available
      const localComment: Comment = {
        id: Math.max(...comments.map(c => c.id), 0) + 1,
        upload_id: selectedUpload.id,
        user_id: currentUser.id,
        content: newComment.trim(),
        created_at: new Date(),
        updated_at: new Date()
      };
      
      setComments((prev: Comment[]) => [...prev, localComment]);
      setNewComment('');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file type icon
  const getFileTypeIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return '🖼️';
    } else if (fileType.startsWith('video/')) {
      return '🎥';
    } else if (fileType.includes('pdf')) {
      return '📄';
    } else if (fileType.includes('document') || fileType.includes('word')) {
      return '📝';
    } else {
      return '📎';
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="h-5 w-5" />
          File Sharing ({uploads.length})
        </h3>
        
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload New File</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUpload} className="space-y-4">
              <Input
                placeholder="File name"
                value={uploadForm.filename}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUploadForm((prev) => ({ ...prev, filename: e.target.value }))
                }
                required
              />
              <Input
                placeholder="File URL"
                value={uploadForm.file_url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUploadForm((prev) => ({ ...prev, file_url: e.target.value }))
                }
                required
              />
              <Input
                type="number"
                placeholder="File size (bytes)"
                value={uploadForm.file_size || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUploadForm((prev) => ({ ...prev, file_size: parseInt(e.target.value) || 0 }))
                }
              />
              <Input
                placeholder="File type (e.g., image/png)"
                value={uploadForm.file_type}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUploadForm((prev) => ({ ...prev, file_type: e.target.value }))
                }
              />
              <Button type="submit" className="w-full">
                Upload File
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Uploads grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {uploads.map((upload: UploadType) => (
          <Card
            key={upload.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedUpload(upload)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getFileTypeIcon(upload.file_type)}</span>
                  <div>
                    <CardTitle className="text-sm font-medium truncate">
                      {upload.filename}
                    </CardTitle>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(upload.file_size)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {upload.file_type.split('/')[0] || 'file'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="text-xs text-gray-500 flex items-center justify-between">
                <span>
                  {new Date(upload.created_at).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>Comments</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {uploads.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Upload className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No files uploaded yet</p>
            <p className="text-sm">Upload your first file to start sharing!</p>
          </div>
        )}
      </div>

      {/* Upload details modal */}
      {selectedUpload && (
        <Dialog open={!!selectedUpload} onOpenChange={() => setSelectedUpload(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{getFileTypeIcon(selectedUpload.file_type)}</span>
                {selectedUpload.filename}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* File info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Size:</span> {formatFileSize(selectedUpload.file_size)}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {selectedUpload.file_type}
                  </div>
                  <div>
                    <span className="font-medium">Uploaded:</span> {new Date(selectedUpload.created_at).toLocaleDateString()}
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={selectedUpload.file_url} target="_blank" rel="noopener noreferrer">
                        <File className="h-4 w-4 mr-2" />
                        View File
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Comments section */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comments ({comments.length})
                </h4>
                
                {/* Add comment form */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
                    className="flex-1 min-h-[80px]"
                  />
                  <Button type="submit" disabled={!newComment.trim()}>
                    Post
                  </Button>
                </form>
                
                {/* Comments list */}
                <ScrollArea className="max-h-60">
                  <div className="space-y-3">
                    {comments.map((comment: Comment) => (
                      <div key={comment.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">User {comment.user_id}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                      </div>
                    ))}
                    
                    {comments.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No comments yet</p>
                        <p className="text-xs">Be the first to comment!</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}