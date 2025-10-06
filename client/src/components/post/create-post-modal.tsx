import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Image, Tag, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authenticatedApiRequest } from '@/lib/auth';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePostModal({ isOpen, onClose }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; imageUrl?: string }) => {
      const response = await authenticatedApiRequest("POST", "/api/posts", postData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Post created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      setContent('');
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) return;
    
    createPostMutation.mutate({ content });
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-effect max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-xl font-semibold">Create a post</DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-0">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-12 h-12" data-testid="create-post-avatar">
              <AvatarImage src={user.profilePictureUrl || undefined} alt={user.name} />
              <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold" data-testid="create-post-username">{user.name}</p>
              <p className="text-sm text-muted-foreground">Post to Everyone</p>
            </div>
          </div>

          <Textarea 
            placeholder="What do you want to talk about?" 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[200px] resize-none border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="textarea-post-content"
          />

          <div className="mt-4 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="p-2" data-testid="button-add-image">
              <Image className="w-6 h-6 text-primary" strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="sm" className="p-2" data-testid="button-add-tag">
              <Tag className="w-6 h-6 text-accent" strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="sm" className="p-2" data-testid="button-add-emoji">
              <Smile className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <Button 
              onClick={handleSubmit} 
              disabled={!content.trim() || createPostMutation.isPending}
              className="w-full"
              data-testid="button-submit-post"
            >
              {createPostMutation.isPending ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
