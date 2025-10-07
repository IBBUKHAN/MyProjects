import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { authenticatedApiRequest } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Heart, UserPlus, MessageCircle } from "lucide-react";
import type { NotificationWithActor } from "@shared/schema";

export default function Notifications() {
  const [, navigate] = useLocation();

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery<NotificationWithActor[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await authenticatedApiRequest("GET", "/api/notifications");
      return res.json();
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await authenticatedApiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/notifications/unread-count"],
      });
    },
  });

  // Mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await authenticatedApiRequest(
        "PATCH",
        `/api/notifications/${notificationId}/read`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/notifications/unread-count"],
      });
    },
  });

  const getNotificationText = (notification: NotificationWithActor) => {
    switch (notification.type) {
      case "like":
        return "liked your post";
      case "follow":
        return "started following you";
      case "comment":
        return "commented on your post";
      default:
        return "interacted with you";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart className="w-5 h-5 text-red-500 fill-current" />;
      case "follow":
        return <UserPlus className="w-5 h-5 text-blue-500" />;
      case "comment":
        return <MessageCircle className="w-5 h-5 text-green-500" />;
      default:
        return null;
    }
  };

  const handleNotificationClick = (notification: NotificationWithActor) => {
    // Mark as read
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === "follow") {
      navigate(`/users/${notification.actorId}`);
    } else if (notification.postId) {
      // For likes and comments, navigate to home (where posts are shown)
      navigate("/");
    }
  };

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Notifications</h1>
            {notifications && notifications.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                Mark all as read
              </Button>
            )}
          </div>

          {/* Notifications list */}
          {isLoading ? (
            <div className="glass-effect rounded-2xl p-6 text-center">
              <p className="text-muted-foreground">Loading notifications...</p>
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="glass-effect rounded-2xl p-6 text-center">
              <p className="text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    notification.isRead ? "opacity-60" : "bg-accent/5"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="p-4 flex items-start gap-4">
                    {/* Actor Avatar */}
                    <Avatar className="w-12 h-12">
                      {notification.actor.profilePictureUrl ? (
                        <AvatarImage
                          src={notification.actor.profilePictureUrl}
                          alt={notification.actor.name}
                        />
                      ) : (
                        <AvatarFallback>
                          {notification.actor.name
                            .split(" ")
                            .map((s) => s[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    {/* Notification Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm">
                          <span className="font-semibold">
                            {notification.actor.name}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {getNotificationText(notification)}
                          </span>
                        </p>
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Post preview for likes/comments */}
                      {notification.post && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          "{notification.post.content}"
                        </p>
                      )}

                      {/* Time */}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notification.createdAt)}
                      </p>

                      {/* Unread indicator */}
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
