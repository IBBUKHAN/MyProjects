import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Heart,
  MessageCircle,
  Share,
  MoreHorizontal,
  Smile,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authenticatedApiRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { PostWithAuthor, User } from "@shared/schema";
import { useAuthStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface PostCardProps {
  post: PostWithAuthor;
}

export function PostCard({ post }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [, navigate] = useLocation();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showLikesModal, setShowLikesModal] = useState(false);

  const { data: commentsData } = useQuery<
    {
      id: string;
      userId: string;
      content: string;
      createdAt: string | null;
      user: { id: string; name: string; profilePictureUrl: string | null };
    }[]
  >({
    queryKey: ["/api/posts", post.id, "comments"],
    enabled: isCommenting,
    queryFn: async () => {
      const res = await authenticatedApiRequest(
        "GET",
        `/api/posts/${post.id}/comments`
      );
      return res.json();
    },
  });

  const { data: likeUsers } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/posts", post.id, "likes"],
    enabled: showLikesModal,
    queryFn: async () => {
      const res = await authenticatedApiRequest(
        "GET",
        `/api/posts/${post.id}/likes`
      );
      return res.json();
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest(
        "POST",
        `/api/posts/${post.id}/like`
      );
      return response.json();
    },
    onSuccess: (data) => {
      setIsLiked(data.liked);
      setLikesCount((prev) => (data.liked ? prev + 1 : prev - 1));
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await authenticatedApiRequest("DELETE", `/api/posts/${post.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trending"] });
      toast({ title: "Post deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete post", variant: "destructive" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      return authenticatedApiRequest("POST", `/api/posts/${post.id}/comments`, {
        content: commentText.trim(),
      });
    },
    onSuccess: async () => {
      setCommentText("");
      setIsCommenting(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  return (
    <div
      className="glass-effect rounded-2xl p-6 mb-4 animate-slide-in"
      data-testid={`post-card-${post.id}`}
    >
      <div className="flex items-start gap-4 mb-4">
        <Avatar
          className="w-12 h-12 cursor-pointer hover:opacity-80 transition-opacity"
          data-testid={`post-avatar-${post.author.id}`}
          onClick={() => navigate(`/users/${post.author.id}`)}
        >
          <AvatarImage
            src={post.author.profilePictureUrl || undefined}
            alt={post.author.name}
          />
          <AvatarFallback>
            {post.author.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3
                className="font-semibold cursor-pointer hover:text-primary transition-colors"
                data-testid={`post-author-${post.id}`}
                onClick={() => navigate(`/users/${post.author.id}`)}
              >
                {post.author.name}
              </h3>
              <p
                className="text-sm text-muted-foreground"
                data-testid={`post-timestamp-${post.id}`}
              >
                {post.createdAt &&
                  formatDistanceToNow(new Date(post.createdAt))}{" "}
                ago
              </p>
            </div>
            {user?.id === post.author.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2"
                    data-testid={`post-menu-${post.id}`}
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => deleteMutation.mutate()}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <p
            className="mt-3 text-foreground leading-relaxed"
            data-testid={`post-content-${post.id}`}
          >
            {post.content}
          </p>
        </div>
      </div>

      {post.imageUrl && (
        <div className="mt-4 px-0">
          <img
            src={post.imageUrl}
            alt="Post content"
            className="rounded-xl w-full object-contain max-h-[480px] bg-muted mx-auto"
            data-testid={`post-image-${post.id}`}
          />
        </div>
      )}

      {/* Edit modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await authenticatedApiRequest(
                      "PUT",
                      `/api/posts/${post.id}`,
                      { content: editContent.trim() }
                    );
                    setIsEditOpen(false);
                    queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
                    queryClient.invalidateQueries({
                      queryKey: ["/api/trending"],
                    });
                    toast({ title: "Post updated" });
                  } catch {
                    toast({
                      title: "Failed to update",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={!editContent.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex items-center gap-6 pt-4 border-t border-border">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={`flex items-center gap-2 transition-colors ${
              isLiked
                ? "text-primary"
                : "text-muted-foreground hover:text-primary"
            }`}
            disabled={likeMutation.isPending}
            data-testid={`button-like-${post.id}`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
          </Button>
          <span
            className="text-sm font-medium text-muted-foreground cursor-pointer hover:underline"
            onClick={() => likesCount > 0 && setShowLikesModal(true)}
          >
            {likesCount}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors"
          onClick={() => setIsCommenting((v) => !v)}
          data-testid={`button-comment-${post.id}`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{post.comments.length}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors ml-auto"
          onClick={async () => {
            const url = `${window.location.origin}/?post=${post.id}`;
            try {
              await navigator.clipboard.writeText(url);
              toast({ title: "Link copied", description: url });
            } catch {
              toast({ title: "Could not copy link", variant: "destructive" });
            }
          }}
          data-testid={`button-share-${post.id}`}
        >
          <Share className="w-5 h-5" />
          <span className="text-sm font-medium">Share</span>
        </Button>
      </div>

      {isCommenting && (
        <div className="mt-4 space-y-4">
          {/* Input row */}
          <div className="flex items-start gap-3">
            <Avatar className="w-9 h-9">
              <AvatarImage
                src={user?.profilePictureUrl || undefined}
                alt={user?.name || ""}
              />
              <AvatarFallback>
                {(user?.name || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              <Textarea
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (commentText.trim()) commentMutation.mutate();
                  }
                }}
                className="min-h-[44px] rounded-full resize-none pr-24"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Emoji"
                  type="button"
                >
                  <Smile className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Add image"
                  type="button"
                >
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Button
                  size="sm"
                  className="h-8 px-4"
                  disabled={!commentText.trim() || commentMutation.isPending}
                  onClick={() => commentMutation.mutate()}
                  type="button"
                >
                  Comment
                </Button>
              </div>
            </div>
          </div>

          {/* Comments list */}
          {commentsData && commentsData.length > 0 && (
            <div className="space-y-4">
              {commentsData.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar
                    className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/users/${c.user.id}`)}
                  >
                    <AvatarImage
                      src={c.user.profilePictureUrl || undefined}
                      alt={c.user.name}
                    />
                    <AvatarFallback>
                      {c.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-accent/20 rounded-2xl px-3 py-2">
                      <p
                        className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                        onClick={() => navigate(`/users/${c.user.id}`)}
                      >
                        {c.user.name}
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {c.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <button className="hover:underline" type="button">
                        Like
                      </button>
                      <button className="hover:underline" type="button">
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Likes Modal */}
      <Dialog open={showLikesModal} onOpenChange={setShowLikesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Likes</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {!likeUsers || likeUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No likes yet.
              </p>
            ) : (
              <div className="space-y-3">
                {likeUsers.map((likeUser) => (
                  <div
                    key={likeUser.id}
                    className="flex items-center gap-3 p-2 hover:bg-accent/10 rounded-lg cursor-pointer"
                    onClick={() => {
                      setShowLikesModal(false);
                      navigate(`/users/${likeUser.id}`);
                    }}
                  >
                    <Avatar className="w-10 h-10">
                      {likeUser.profilePictureUrl ? (
                        <AvatarImage
                          src={likeUser.profilePictureUrl}
                          alt={likeUser.name}
                        />
                      ) : (
                        <AvatarFallback>
                          {likeUser.name
                            .split(" ")
                            .map((s) => s[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {likeUser.name}
                      </p>
                      {likeUser.bio && (
                        <p className="text-xs text-muted-foreground truncate">
                          {likeUser.bio}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
