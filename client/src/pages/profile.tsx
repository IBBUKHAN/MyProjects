import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Camera } from "lucide-react";
import type { PostWithAuthor, User } from "@shared/schema";

export default function Profile() {
  const { user } = useAuthStore();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"posts" | "about" | "media">(
    "posts"
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [isCoverOpen, setIsCoverOpen] = useState(false);
  const [followModal, setFollowModal] = useState<
    "followers" | "following" | null
  >(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [coverPreviewSrc, setCoverPreviewSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startDrag, setStartDrag] = useState<{ x: number; y: number } | null>(
    null
  );
  const [baseScale, setBaseScale] = useState(1);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // When photo modal opens, seed preview with current profile picture (if any)
  useEffect(() => {
    if (isPhotoOpen) {
      if (user?.profilePictureUrl) {
        setPreviewSrc(user.profilePictureUrl);
      } else {
        setPreviewSrc(null);
      }
      setScale(1);
      setDrag({ x: 0, y: 0 });
      setBaseScale(1);
    }
  }, [isPhotoOpen]);

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

  const { data: followers } = useQuery<Omit<User, "password">[]>({
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

  const { data: following } = useQuery<Omit<User, "password">[]>({
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
              className="relative h-48 group cursor-pointer"
              data-testid="profile-cover"
              onClick={() => setIsCoverOpen(true)}
            >
              {(user as any)?.coverImageUrl ? (
                <img
                  src={(user as any).coverImageUrl}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-primary via-accent to-primary" />
              )}
              {/* Edit Cover Button - shows on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-background/90 rounded-full p-3">
                  <Camera className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Profile Info */}
            <div className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 -mt-16 mb-6">
                <Avatar
                  className="w-32 h-32 border-4 border-background cursor-pointer"
                  data-testid="profile-avatar"
                  onClick={() => setIsPhotoOpen(true)}
                >
                  <AvatarImage
                    src={user.profilePictureUrl || undefined}
                    alt={user.name}
                  />
                  <AvatarFallback className="text-4xl">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h1
                    className="text-2xl font-bold truncate"
                    data-testid="profile-name"
                  >
                    {user.name}
                  </h1>
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
              {user.bio && (
                <div className="mb-6">
                  <p
                    className="text-foreground leading-relaxed"
                    data-testid="profile-bio"
                  >
                    {user.bio}
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
                    {followCounts?.followers ?? 0}
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
      {/* Profile photo modal */}
      <Dialog
        open={isPhotoOpen}
        onOpenChange={(v) => {
          setIsPhotoOpen(v);
          if (!v) {
            setPreviewSrc(null);
            setScale(1);
            setDrag({ x: 0, y: 0 });
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Profile photo</DialogTitle>
          </DialogHeader>
          <div className="flex gap-6">
            <div className="flex-1">
              <div
                ref={containerRef}
                className="relative w-full aspect-square rounded-full overflow-hidden bg-black/60"
                onMouseDown={(e) =>
                  setStartDrag({ x: e.clientX - drag.x, y: e.clientY - drag.y })
                }
                onMouseUp={() => setStartDrag(null)}
                onMouseLeave={() => setStartDrag(null)}
                onMouseMove={(e) => {
                  if (startDrag) {
                    setDrag({
                      x: e.clientX - startDrag.x,
                      y: e.clientY - startDrag.y,
                    });
                  }
                }}
              >
                {previewSrc ? (
                  <img
                    ref={imgRef}
                    src={previewSrc}
                    alt="preview"
                    className="select-none pointer-events-none"
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(-50%, -50%) translate(${
                        drag.x
                      }px, ${drag.y}px) scale(${baseScale * scale})`,
                    }}
                    onLoad={() => {
                      const img = imgRef.current;
                      const container = containerRef.current;
                      if (!img || !container) return;
                      const cont = container.clientWidth || 512;
                      const s = Math.max(
                        cont / img.naturalWidth,
                        cont / img.naturalHeight
                      );
                      setBaseScale(s);
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <span className="text-6xl font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                {/* circular mask border */}
                <div className="absolute inset-0 rounded-full ring-2 ring-white/60 pointer-events-none" />
              </div>
              {previewSrc && (
                <div className="mt-4">
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>
            <div className="w-56 space-y-3">
              <Button
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () =>
                      setPreviewSrc(reader.result as string);
                    reader.readAsDataURL(file);
                  };
                  input.click();
                }}
                className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white"
              >
                Update photo
              </Button>
              <Button
                variant="destructive"
                className="w-full bg-[#e63946] hover:bg-[#d62839] text-white"
                onClick={async () => {
                  if (!user) return;
                  await authenticatedApiRequest(
                    "PUT",
                    `/api/users/${user.id}`,
                    { profilePictureUrl: null }
                  );
                  const updated = { ...user, profilePictureUrl: null } as any;
                  useAuthStore.getState().setUser(updated);
                  setIsPhotoOpen(false);
                }}
              >
                Delete
              </Button>
              {previewSrc && (
                <Button
                  className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white"
                  onClick={async () => {
                    // Render to canvas with current transforms
                    const size = 512;
                    const canvas = document.createElement("canvas");
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext("2d")!;
                    // fill circle background
                    ctx.fillStyle = "#000";
                    ctx.fillRect(0, 0, size, size);
                    const img = imgRef.current!;
                    // compute draw size centered with transforms
                    const container = containerRef.current!;
                    const baseW = img.naturalWidth;
                    const baseH = img.naturalHeight;
                    const scalePx = scale;
                    const drawW = baseW * (baseScale * scalePx);
                    const drawH = baseH * (baseScale * scalePx);
                    // translate drag from container px to canvas px (assuming container is square)
                    const contSize = container.clientWidth || size;
                    const dx = (size - drawW) / 2 + (drag.x * size) / contSize;
                    const dy = (size - drawH) / 2 + (drag.y * size) / contSize;
                    ctx.drawImage(img, dx, dy, drawW, drawH);
                    // convert to blob and upload
                    canvas.toBlob(async (blob) => {
                      if (!blob) return;
                      const form = new FormData();
                      form.append("image", blob, "profile.png");
                      const res = await authenticatedApiRequest(
                        "POST",
                        "/api/upload/profile-picture",
                        form
                      );
                      const { user: updated } = await res.json();
                      const cacheBusted = updated?.profilePictureUrl
                        ? `${updated.profilePictureUrl}?t=${Date.now()}`
                        : null;
                      useAuthStore.getState().setUser({
                        ...(updated as any),
                        profilePictureUrl: cacheBusted,
                      } as any);
                      setIsPhotoOpen(false);
                    }, "image/png");
                  }}
                >
                  Save
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cover photo modal */}
      <Dialog
        open={isCoverOpen}
        onOpenChange={(v) => {
          setIsCoverOpen(v);
          if (!v) {
            setCoverPreviewSrc(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cover photo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-6">
            <div className="w-full">
              <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden bg-black/60">
                {coverPreviewSrc ? (
                  <img
                    src={coverPreviewSrc}
                    alt="cover preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary" />
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () =>
                      setCoverPreviewSrc(reader.result as string);
                    reader.readAsDataURL(file);
                  };
                  input.click();
                }}
                className="flex-1 bg-[#0a66c2] hover:bg-[#004182] text-white"
              >
                Upload cover
              </Button>
              {coverPreviewSrc && (
                <Button
                  className="flex-1 bg-[#0a66c2] hover:bg-[#004182] text-white"
                  onClick={async () => {
                    if (!user) return;

                    // Convert base64 to blob
                    const response = await fetch(coverPreviewSrc);
                    const blob = await response.blob();

                    // Upload to server
                    const form = new FormData();
                    form.append("image", blob, "cover.png");

                    const res = await authenticatedApiRequest(
                      "POST",
                      "/api/upload/cover-image",
                      form
                    );
                    const { user: updated } = await res.json();

                    // Update user in store
                    useAuthStore.getState().setUser(updated as any);

                    setIsCoverOpen(false);
                    setCoverPreviewSrc(null);
                  }}
                >
                  Save
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setCoverPreviewSrc(null);
                  setIsCoverOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
