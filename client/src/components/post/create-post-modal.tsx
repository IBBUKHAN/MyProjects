import { useRef, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Image, Tag, Smile, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authenticatedApiRequest } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  openAction?: "image" | "text";
  onPostCreated?: () => void;
}

export function CreatePostModal({
  isOpen,
  onClose,
  openAction,
  onPostCreated,
}: CreatePostModalProps) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; imageUrl?: string }) => {
      const response = await authenticatedApiRequest(
        "POST",
        "/api/posts",
        postData
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Post created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trending"] });
      setContent("");
      setImageUrl(undefined);
      onPostCreated?.(); // Notify parent to refresh posts
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
    if (!content.trim() && !imageUrl) return;
    createPostMutation.mutate({ content, imageUrl });
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingImage(true);
      const form = new FormData();
      form.append("image", file);
      const res = await authenticatedApiRequest(
        "POST",
        "/api/upload/post-image",
        form
      );
      const data = await res.json();
      if (data?.url) {
        setImageUrl(data.url as string);
        toast({ title: "Image added", description: "Your image is attached." });
      } else {
        throw new Error("Invalid response");
      }
    } catch (err) {
      toast({
        title: "Upload failed",
        description: "Could not upload image.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // When the dialog opens, trigger requested action like LinkedIn quick buttons
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      if (openAction === "image") {
        handlePickImage();
      } else if (openAction === "text") {
        textareaRef.current?.focus();
      }
    }, 50);
    return () => clearTimeout(id);
  }, [isOpen, openAction]);

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-effect max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-xl font-semibold">
            Create a post
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-0">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-12 h-12" data-testid="create-post-avatar">
              <AvatarImage
                src={user.profilePictureUrl || undefined}
                alt={user.name}
              />
              <AvatarFallback>
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold" data-testid="create-post-username">
                {user.name}
              </p>
              <p className="text-sm text-muted-foreground">Post to Everyone</p>
            </div>
          </div>

          <Textarea
            placeholder="What do you want to talk about?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            ref={textareaRef}
            className="min-h-[200px] resize-none border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="textarea-post-content"
          />

          <div className="mt-4 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              data-testid="button-add-image"
              onClick={handlePickImage}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              ) : (
                <Image className="w-6 h-6 text-primary" strokeWidth={1.5} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              data-testid="button-add-tag"
              onClick={() =>
                toast({
                  title: "Coming soon",
                  description: "Tagging not implemented yet.",
                })
              }
            >
              <Tag className="w-6 h-6 text-accent" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              data-testid="button-add-emoji"
              onClick={() =>
                toast({
                  title: "Coming soon",
                  description: "Emoji picker not implemented yet.",
                })
              }
            >
              <Smile
                className="w-6 h-6 text-muted-foreground"
                strokeWidth={1.5}
              />
            </Button>
            {isUploadingImage && (
              <span className="text-sm text-muted-foreground animate-pulse">
                Uploading image...
              </span>
            )}
          </div>

          {/* Image uploading skeleton/loader */}
          {isUploadingImage && (
            <div className="mt-4 relative">
              <div className="rounded-lg bg-accent/20 h-64 w-full flex items-center justify-center animate-pulse">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Uploading your image...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Uploaded image preview */}
          {imageUrl && !isUploadingImage && (
            <div className="mt-4 relative group">
              <img
                src={imageUrl}
                alt="Selected"
                className="rounded-lg max-h-64 object-contain w-full"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setImageUrl(undefined)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border">
            <Button
              onClick={handleSubmit}
              disabled={
                (!content.trim() && !imageUrl) || createPostMutation.isPending
              }
              className="w-full"
              data-testid="button-submit-post"
            >
              {createPostMutation.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
