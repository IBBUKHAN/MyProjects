import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PostCard } from "@/components/post/post-card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authenticatedApiRequest } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { PostWithAuthor, User } from "@shared/schema";

export default function UserProfile() {
  const { user: currentUser } = useAuthStore();
  const [, params] = useRoute("/users/:id");
  const profileUserId = params?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState<"posts" | "about" | "media">(
    "posts"
  );
  const [followModal, setFollowModal] = useState<
    "followers" | "following" | null
  >(null);

  const { data: profileUser, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/users", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return null;
      const res = await authenticatedApiRequest(
        "GET",
        `/api/users/${profileUserId}`
      );
      return res.json();
    },
    enabled: !!profileUserId,
  });

  const { data: userPosts, isLoading: postsLoading } = useQuery<
    PostWithAuthor[]
  >({
    queryKey: ["/api/users", profileUserId, "posts"],
    queryFn: async () => {
      if (!profileUserId) return [];
      const response = await authenticatedApiRequest(
        "GET",
        `/api/users/${profileUserId}/posts`
      );
      return response.json();
    },
    enabled: !!profileUserId,
  });

  const { data: followers } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/users", profileUserId, "followers"],
    queryFn: async () => {
      if (!profileUserId) return [];
      const res = await authenticatedApiRequest(
        "GET",
        `/api/users/${profileUserId}/followers`
      );
      return res.json();
    },
    enabled: !!profileUserId && followModal === "followers",
  });

  const { data: following } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/users", profileUserId, "following"],
    queryFn: async () => {
      if (!profileUserId) return [];
      const res = await authenticatedApiRequest(
        "GET",
        `/api/users/${profileUserId}/following`
      );
      return res.json();
    },
    enabled: !!profileUserId && followModal === "following",
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!profileUserId) throw new Error("No user");
      if (profileUser?.isFollowing) {
        await authenticatedApiRequest(
          "DELETE",
          `/api/users/${profileUserId}/follow`
        );
      } else {
        await authenticatedApiRequest(
          "POST",
          `/api/users/${profileUserId}/follow`
        );
      }
    },
    onSuccess: () => {
      // Invalidate the profile user's data
      queryClient.invalidateQueries({
        queryKey: ["/api/users", profileUserId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });

      // Invalidate current user's profile data to update following count
      if (currentUser?.id) {
        queryClient.invalidateQueries({
          queryKey: [`/api/users/${currentUser.id}`],
        });
        queryClient.invalidateQueries({
          queryKey: [`/api/users/${currentUser.id}/follow-counts`],
        });
      }

      toast({
        title: profileUser?.isFollowing ? "Unfollowed" : "Followed",
        description: profileUser?.isFollowing
          ? `You unfollowed ${profileUser?.name}`
          : `You are now following ${profileUser?.name}`,
      });
    },
  });

  const connections =
    (profileUser?.followers ?? 0) + (profileUser?.following ?? 0);

  if (!currentUser) return null;

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-20 pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="glass-effect rounded-2xl overflow-hidden mb-6">
              <div className="h-48 bg-gradient-to-r from-primary via-accent to-primary"></div>
              <div className="px-6 pb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 -mt-16 mb-6">
                  <Skeleton className="w-32 h-32 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-20 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Header */}
          <div className="glass-effect rounded-2xl overflow-hidden mb-6">
            {/* Cover Image */}
            <div
              className="h-48 bg-gradient-to-r from-primary via-accent to-primary"
              data-testid="profile-cover"
            ></div>

            {/* Profile Info */}
            <div className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 -mt-16 mb-6">
                <Avatar
                  className="w-32 h-32 border-4 border-background"
                  data-testid="profile-avatar"
                >
                  <AvatarImage
                    src={profileUser?.profilePictureUrl || undefined}
                    alt={profileUser?.name}
                  />
                  <AvatarFallback className="text-4xl">
                    {profileUser?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h1
                    className="text-2xl font-bold truncate"
                    data-testid="profile-name"
                  >
                    {profileUser?.name}
                  </h1>
                  {profileUser?.bio && (
                    <p
                      className="text-muted-foreground"
                      data-testid="profile-title"
                    >
                      {profileUser?.bio}
                    </p>
                  )}
                  {(profileUser as any)?.city ||
                  (profileUser as any)?.country ? (
                    <p
                      className="text-sm text-muted-foreground mt-1"
                      data-testid="profile-location"
                    >
                      {[
                        (profileUser as any)?.city,
                        (profileUser as any)?.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
                <Button
                  className="px-4 py-2"
                  variant={profileUser?.isFollowing ? "outline" : "default"}
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                >
                  {profileUser?.isFollowing ? "Unfollow" : "Follow"}
                </Button>
              </div>

              {/* Bio */}
              {profileUser?.bio && (
                <div className="mb-6">
                  <p
                    className="text-foreground leading-relaxed"
                    data-testid="profile-bio"
                  >
                    {profileUser.bio}
                  </p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-border">
                <div
                  className="text-center cursor-pointer hover:bg-accent/10 p-2 rounded-lg transition-colors"
                  onClick={() => setFollowModal("followers")}
                >
                  <p
                    className="text-2xl font-bold"
                    data-testid="profile-followers"
                  >
                    {profileUser?.followers ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Followers</p>
                </div>
                <div
                  className="text-center cursor-pointer hover:bg-accent/10 p-2 rounded-lg transition-colors"
                  onClick={() => setFollowModal("following")}
                >
                  <p
                    className="text-2xl font-bold"
                    data-testid="profile-following"
                  >
                    {profileUser?.following ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Following</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="profile-posts">
                    {userPosts?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Posts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="glass-effect rounded-2xl p-2 mb-6">
            <div className="flex gap-2">
              <Button
                variant={activeTab === "posts" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("posts")}
                data-testid="tab-posts"
              >
                Posts
              </Button>
              <Button
                variant={activeTab === "about" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("about")}
                data-testid="tab-about"
              >
                About
              </Button>
              <Button
                variant={activeTab === "media" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("media")}
                data-testid="tab-media"
              >
                Media
              </Button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "posts" && (
            <div className="space-y-4">
              {postsLoading ? (
                <div className="space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="glass-effect rounded-2xl p-6">
                      <div className="flex items-start gap-4 mb-4">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-2" />
                          <Skeleton className="h-3 w-24 mb-4" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !userPosts || userPosts.length === 0 ? (
                <div className="glass-effect rounded-2xl p-6 text-center">
                  <p
                    className="text-muted-foreground"
                    data-testid="text-no-user-posts"
                  >
                    No posts yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "about" && (
            <div className="glass-effect rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-4">About</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-muted-foreground mb-2">
                    Bio
                  </h4>
                  <p className="text-foreground" data-testid="about-bio">
                    {profileUser?.bio || "No bio provided yet."}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground mb-2">
                    Joined
                  </h4>
                  <p className="text-foreground" data-testid="about-joined">
                    {profileUser?.createdAt &&
                      new Date(profileUser.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                        }
                      )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div className="glass-effect rounded-2xl p-6 text-center">
              <p className="text-muted-foreground" data-testid="text-no-media">
                No media shared yet.
              </p>
            </div>
          )}
        </div>
      </div>

      <MobileNav />

      {/* Followers/Following Modal */}
      <Dialog open={!!followModal} onOpenChange={() => setFollowModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {followModal === "followers" ? "Followers" : "Following"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {followModal === "followers" && (
              <div className="space-y-3">
                {!followers || followers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No followers yet.
                  </p>
                ) : (
                  followers.map((follower) => (
                    <div
                      key={follower.id}
                      className="flex items-center gap-3 p-2 hover:bg-accent/10 rounded-lg cursor-pointer"
                      onClick={() => {
                        setFollowModal(null);
                        navigate(`/users/${follower.id}`);
                      }}
                    >
                      <Avatar className="w-10 h-10">
                        {follower.profilePictureUrl ? (
                          <AvatarImage
                            src={follower.profilePictureUrl}
                            alt={follower.name}
                          />
                        ) : (
                          <AvatarFallback>
                            {follower.name
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
                          {follower.name}
                        </p>
                        {follower.bio && (
                          <p className="text-xs text-muted-foreground truncate">
                            {follower.bio}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {followModal === "following" && (
              <div className="space-y-3">
                {!following || following.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Not following anyone yet.
                  </p>
                ) : (
                  following.map((followingUser) => (
                    <div
                      key={followingUser.id}
                      className="flex items-center gap-3 p-2 hover:bg-accent/10 rounded-lg cursor-pointer"
                      onClick={() => {
                        setFollowModal(null);
                        navigate(`/users/${followingUser.id}`);
                      }}
                    >
                      <Avatar className="w-10 h-10">
                        {followingUser.profilePictureUrl ? (
                          <AvatarImage
                            src={followingUser.profilePictureUrl}
                            alt={followingUser.name}
                          />
                        ) : (
                          <AvatarFallback>
                            {followingUser.name
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
                          {followingUser.name}
                        </p>
                        {followingUser.bio && (
                          <p className="text-xs text-muted-foreground truncate">
                            {followingUser.bio}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
