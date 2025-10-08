import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PostCard } from "@/components/post/post-card";
import { CreatePostModal } from "@/components/post/create-post-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authenticatedApiRequest } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { PostWithAuthor } from "@shared/schema";
import { useLocation } from "wouter";

export default function Home() {
  const { user } = useAuthStore();
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [createAction, setCreateAction] = useState<
    "image" | "text" | undefined
  >(undefined);
  const [, navigate] = useLocation();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [followModal, setFollowModal] = useState<
    "followers" | "following" | null
  >(null);

  const {
    data: posts,
    isLoading,
    error,
  } = useQuery<PostWithAuthor[]>({
    queryKey: ["/api/posts", selectedTag],
    queryFn: async () => {
      const url = selectedTag
        ? `/api/posts?tag=${encodeURIComponent(selectedTag.replace(/^#/, ""))}`
        : "/api/posts";
      const response = await authenticatedApiRequest("GET", url);
      return response.json();
    },
    enabled: !!user,
  });

  const { data: trendingTopics } = useQuery<
    Array<{ tag: string; count: number }>
  >({
    queryKey: ["/api/trending"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/trending");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: suggestions } = useQuery<
    Array<{ id: string; name: string; profilePictureUrl: string | null }>
  >({
    queryKey: ["/api/suggestions"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/suggestions");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: followCounts } = useQuery<{
    followers: number;
    following: number;
  }>({
    queryKey: ["/api/users", user?.id, "counts"],
    enabled: !!user,
    queryFn: async () => {
      const res = await authenticatedApiRequest(
        "GET",
        `/api/users/${user!.id}`
      );
      const u = await res.json();
      return { followers: u.followers ?? 0, following: u.following ?? 0 };
    },
  });

  const { data: followers, isLoading: isLoadingFollowers } = useQuery<
    Array<{
      id: string;
      name: string;
      profilePictureUrl: string | null;
      bio: string | null;
    }>
  >({
    queryKey: ["/api/users", user?.id, "followers"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await authenticatedApiRequest(
        "GET",
        `/api/users/${user.id}/followers`
      );
      return res.json();
    },
    enabled: !!user && followModal === "followers",
  });

  const { data: following, isLoading: isLoadingFollowing } = useQuery<
    Array<{
      id: string;
      name: string;
      profilePictureUrl: string | null;
      bio: string | null;
    }>
  >({
    queryKey: ["/api/users", user?.id, "following"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await authenticatedApiRequest(
        "GET",
        `/api/users/${user.id}/following`
      );
      return res.json();
    },
    enabled: !!user && followModal === "following",
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-20 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar - User Profile Card */}
            <aside className="lg:col-span-3 hidden lg:block">
              <div className="sticky top-24">
                <div className="glass-effect rounded-2xl p-6 mb-4">
                  <div className="text-center">
                    <Avatar
                      className="w-20 h-20 mx-auto mb-4 border-2 border-primary"
                      data-testid="sidebar-user-avatar"
                    >
                      <AvatarImage
                        src={user.profilePictureUrl || undefined}
                        alt={user.name}
                      />
                      <AvatarFallback className="text-2xl">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3
                      className="font-semibold text-lg"
                      data-testid="sidebar-user-name"
                    >
                      {user.name}
                    </h3>
                    <p
                      className="text-sm text-muted-foreground mb-4"
                      data-testid="sidebar-user-bio"
                    >
                      {user.bio || "Professional • EchoMateLite Member"}
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-center pt-4 border-t border-border">
                      <div
                        className="cursor-pointer hover:bg-accent/10 p-2 rounded-lg transition-colors"
                        onClick={() => setFollowModal("followers")}
                      >
                        <p
                          className="text-xl font-bold"
                          data-testid="sidebar-followers-count"
                        >
                          {followCounts?.followers ?? 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Followers
                        </p>
                      </div>
                      <div
                        className="cursor-pointer hover:bg-accent/10 p-2 rounded-lg transition-colors"
                        onClick={() => setFollowModal("following")}
                      >
                        <p
                          className="text-xl font-bold"
                          data-testid="sidebar-following-count"
                        >
                          {followCounts?.following ?? 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Following
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="glass-effect rounded-2xl p-4">
                  <h4 className="font-semibold mb-3">Quick Links</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        toast({
                          title: "Coming Soon",
                          description:
                            "Saved Posts feature will be available soon!",
                        });
                      }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 transition-colors text-sm w-full text-left"
                    >
                      <span className="w-5 h-5 text-primary">📚</span>
                      Saved Posts
                    </button>
                    <button
                      onClick={() => {
                        toast({
                          title: "Coming Soon",
                          description: "Groups feature will be available soon!",
                        });
                      }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 transition-colors text-sm w-full text-left"
                    >
                      <span className="w-5 h-5 text-accent">👥</span>
                      Groups
                    </button>
                    <button
                      onClick={() => {
                        toast({
                          title: "Coming Soon",
                          description: "Events feature will be available soon!",
                        });
                      }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 transition-colors text-sm w-full text-left"
                    >
                      <span className="w-5 h-5 text-muted-foreground">📅</span>
                      Events
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Feed */}
            <main className="lg:col-span-6">
              {/* Create Post Card */}
              <div className="glass-effect rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar
                    className="w-12 h-12"
                    data-testid="create-post-trigger-avatar"
                  >
                    <AvatarImage
                      src={user.profilePictureUrl || undefined}
                      alt={user.name}
                    />
                    <AvatarFallback>
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    variant="outline"
                    className="flex-1 justify-start text-muted-foreground hover:bg-accent/10"
                    onClick={() => {
                      setCreateAction("text");
                      setIsCreatePostOpen(true);
                    }}
                    data-testid="button-create-post-trigger"
                  >
                    What's on your mind, {user.name}?
                  </Button>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4"
                    onClick={() => {
                      setCreateAction("image");
                      setIsCreatePostOpen(true);
                    }}
                    data-testid="button-add-photo"
                  >
                    <Image className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">Photo</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4"
                    onClick={() => navigate("/compose/article")}
                    data-testid="button-add-article"
                  >
                    <FileText className="w-5 h-5 text-accent" />
                    <span className="text-sm font-medium">Article</span>
                  </Button>
                </div>
              </div>

              {/* Feed Posts */}
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
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
              ) : error ? (
                <div className="glass-effect rounded-2xl p-6 text-center">
                  <p className="text-muted-foreground">
                    Failed to load posts. Please try again.
                  </p>
                </div>
              ) : !posts || posts.length === 0 ? (
                <div className="glass-effect rounded-2xl p-6 text-center">
                  <p
                    className="text-muted-foreground"
                    data-testid="text-no-posts"
                  >
                    No posts yet. Create your first post!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </main>

            {/* Right Sidebar - Trending & Suggestions */}
            <aside className="lg:col-span-3 hidden lg:block">
              <div className="sticky top-24 space-y-4">
                {/* Trending Topics */}
                <div className="glass-effect rounded-2xl p-6">
                  <h3 className="font-semibold mb-4">Trending Topics</h3>
                  {!trendingTopics || trendingTopics.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        No trending topics yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Start using hashtags in your posts
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {trendingTopics.map((trend, i) => (
                        <div
                          key={i}
                          className="cursor-pointer hover:bg-accent/10 p-2 rounded-lg transition-colors"
                          data-testid={`trending-topic-${i}`}
                          onClick={() => {
                            setSelectedTag(trend.tag);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          <p className="text-sm font-medium">{trend.tag}</p>
                          <p className="text-xs text-muted-foreground">
                            {trend.count} posts
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Who to Follow */}
                <div className="glass-effect rounded-2xl p-6">
                  <h3 className="font-semibold mb-4">Who to Follow</h3>
                  {!suggestions || suggestions.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent/20 flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        No suggestions right now
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Check back later for people to follow
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {suggestions.map((person, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3"
                          data-testid={`suggestion-${i}`}
                        >
                          <Avatar className="w-10 h-10">
                            {person.profilePictureUrl ? (
                              <AvatarImage
                                src={person.profilePictureUrl}
                                alt={person.name}
                              />
                            ) : (
                              <AvatarFallback>
                                {person.name
                                  .split(" ")
                                  .map((s) => s[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => navigate(`/users/${person.id}`)}
                          >
                            <p className="text-sm font-medium truncate">
                              {person.name}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            data-testid={`button-follow-${i}`}
                            onClick={async () => {
                              try {
                                await authenticatedApiRequest(
                                  "POST",
                                  `/api/users/${person.id}/follow`
                                );
                                // Invalidate suggestions
                                queryClient.invalidateQueries({
                                  queryKey: ["/api/suggestions"],
                                });
                                // Invalidate current user's profile data to update following count
                                if (user?.id) {
                                  queryClient.invalidateQueries({
                                    queryKey: [`/api/users/${user.id}`],
                                  });
                                  queryClient.invalidateQueries({
                                    queryKey: [
                                      `/api/users/${user.id}/follow-counts`,
                                    ],
                                  });
                                }
                                toast({
                                  title: "Followed",
                                  description: `You are now following ${person.name}`,
                                });
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                          >
                            Follow
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <MobileNav />
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => {
          setIsCreatePostOpen(false);
          setCreateAction(undefined);
        }}
        openAction={createAction}
      />

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
                {isLoadingFollowers ? (
                  // Loading skeleton for followers
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))
                ) : !followers || followers.length === 0 ? (
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
                {isLoadingFollowing ? (
                  // Loading skeleton for following
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))
                ) : !following || following.length === 0 ? (
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
