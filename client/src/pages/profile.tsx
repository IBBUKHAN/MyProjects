import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PostCard } from "@/components/post/post-card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { authenticatedApiRequest } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import type { PostWithAuthor } from "@shared/schema";

export default function Profile() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"posts" | "about" | "media">(
    "posts"
  );
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: userPosts, isLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ["/api/users", user?.id, "posts"],
    queryFn: async () => {
      if (!user) return [];
      const response = await authenticatedApiRequest(
        "GET",
        `/api/users/${user.id}/posts`
      );
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

  const connections =
    (followCounts?.followers ?? 0) + (followCounts?.following ?? 0);

  const editSchema = z.object({
    name: z.string().min(1, "Name is required"),
    bio: z.string().optional(),
    birthday: z.string().optional(),
    education: z.string().optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    contactNumber: z.string().optional(),
  });

  type EditData = z.infer<typeof editSchema>;

  const form = useForm<EditData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user?.name || "",
      bio: user?.bio || "",
      birthday: user?.birthday
        ? new Date(user.birthday as any).toISOString().substring(0, 10)
        : "",
      education: (user as any)?.education || "",
      country: (user as any)?.country || "",
      city: (user as any)?.city || "",
      contactNumber: (user as any)?.contactNumber || "",
    },
    values: {
      name: user?.name || "",
      bio: user?.bio || "",
      birthday: user?.birthday
        ? new Date(user.birthday as any).toISOString().substring(0, 10)
        : "",
      education: (user as any)?.education || "",
      country: (user as any)?.country || "",
      city: (user as any)?.city || "",
      contactNumber: (user as any)?.contactNumber || "",
    },
  });

  const handleSave = async (data: EditData) => {
    if (!user) return;
    const res = await authenticatedApiRequest("PUT", `/api/users/${user.id}`, {
      name: data.name,
      bio: data.bio || null,
      birthday: data.birthday ? new Date(data.birthday).toISOString() : null,
      education: data.education || null,
      country: data.country || null,
      city: data.city || null,
      contactNumber: data.contactNumber || null,
    });
    const updated = await res.json();
    useAuthStore.getState().setUser(updated);
    setIsEditOpen(false);
  };

  if (!user) return null;

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
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16 mb-6">
                <Avatar
                  className="w-32 h-32 border-4 border-background"
                  data-testid="profile-avatar"
                >
                  <AvatarImage
                    src={user.profilePictureUrl || undefined}
                    alt={user.name}
                  />
                  <AvatarFallback className="text-4xl">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold" data-testid="profile-name">
                    {user.name}
                  </h1>
                  {user.bio && (
                    <p
                      className="text-muted-foreground"
                      data-testid="profile-title"
                    >
                      {user.bio}
                    </p>
                  )}
                  {(user as any)?.city || (user as any)?.country ? (
                    <p
                      className="text-sm text-muted-foreground mt-1"
                      data-testid="profile-location"
                    >
                      {[(user as any)?.city, (user as any)?.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
                <Button
                  className="px-4 py-2"
                  data-testid="button-edit-profile"
                  onClick={() => setIsEditOpen(true)}
                >
                  Edit Profile
                </Button>
              </div>

              {/* Bio */}
              <div className="mb-6">
                <p
                  className="text-foreground leading-relaxed"
                  data-testid="profile-bio"
                >
                  {user.bio ||
                    "Passionate about creating amazing experiences and connecting with professionals worldwide. Building the future one project at a time."}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-border">
                <div className="text-center">
                  <p
                    className="text-2xl font-bold"
                    data-testid="profile-followers"
                  >
                    {followCounts?.followers ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <p
                    className="text-2xl font-bold"
                    data-testid="profile-following"
                  >
                    {followCounts?.following ?? 0}
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
              {isLoading ? (
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
                    No posts yet. Share your first thought!
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
                    {user.bio || "No bio provided yet."}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground mb-2">
                    Email
                  </h4>
                  <p className="text-foreground" data-testid="about-email">
                    {user.email}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground mb-2">
                    Joined
                  </h4>
                  <p className="text-foreground" data-testid="about-joined">
                    {new Date(user.createdAt!).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                    })}
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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(handleSave)}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell people about yourself"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="birthday"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birthday</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="education"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Education</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., BSc Computer Science"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact number</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 555 000 0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
