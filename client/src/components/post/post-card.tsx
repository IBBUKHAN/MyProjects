import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Share, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { authenticatedApiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { PostWithAuthor } from '@shared/schema';

interface PostCardProps {
  post: PostWithAuthor;
}

export function PostCard({ post }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest("POST", `/api/posts/${post.id}/like`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsLiked(data.liked);
      setLikesCount(prev => data.liked ? prev + 1 : prev - 1);
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update like status",
        variant: "destructive",
      });
    },
  });

  const handleLike = () => {
    likeMutation.mutate();
  };

  return (
    <div className="glass-effect rounded-2xl p-6 mb-4 animate-slide-in" data-testid={`post-card-${post.id}`}>
      <div className="flex items-start gap-4 mb-4">
        <Avatar className="w-12 h-12" data-testid={`post-avatar-${post.author.id}`}>
          <AvatarImage src={post.author.profilePictureUrl || undefined} alt={post.author.name} />
          <AvatarFallback>{post.author.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold" data-testid={`post-author-${post.id}`}>{post.author.name}</h3>
              <p className="text-sm text-muted-foreground" data-testid={`post-timestamp-${post.id}`}>
                {post.createdAt && formatDistanceToNow(new Date(post.createdAt))} ago
              </p>
            </div>
            <Button variant="ghost" size="sm" className="p-2" data-testid={`post-menu-${post.id}`}>
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>
          <p className="mt-3 text-foreground leading-relaxed" data-testid={`post-content-${post.id}`}>
            {post.content}
          </p>
          {post.imageUrl && (
            <img 
              src={post.imageUrl} 
              alt="Post content" 
              className="mt-4 rounded-xl w-full object-cover h-64"
              data-testid={`post-image-${post.id}`}
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-6 pt-4 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={`flex items-center gap-2 transition-colors ${
            isLiked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
          }`}
          disabled={likeMutation.isPending}
          data-testid={`button-like-${post.id}`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          <span className="text-sm font-medium">{likesCount}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors"
          data-testid={`button-comment-${post.id}`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{post.comments.length}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors ml-auto"
          data-testid={`button-share-${post.id}`}
        >
          <Share className="w-5 h-5" />
          <span className="text-sm font-medium">Share</span>
        </Button>
      </div>
    </div>
  );
}
