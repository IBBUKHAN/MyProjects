import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/navbar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { PostCard } from '@/components/post/post-card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { authenticatedApiRequest } from '@/lib/auth';
import { useAuthStore } from '@/lib/store';
import type { PostWithAuthor } from '@shared/schema';

export default function Profile() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'media'>('posts');

  const { data: userPosts, isLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ['/api/users', user?.id, 'posts'],
    queryFn: async () => {
      if (!user) return [];
      const response = await authenticatedApiRequest("GET", `/api/users/${user.id}/posts`);
      return response.json();
    },
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-20 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Profile Header */}
          <div className="glass-effect rounded-2xl overflow-hidden mb-6">
            {/* Cover Image */}
            <div className="h-48 bg-gradient-to-r from-primary via-accent to-primary" data-testid="profile-cover"></div>
            
            {/* Profile Info */}
            <div className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16 mb-6">
                <Avatar className="w-32 h-32 border-4 border-background" data-testid="profile-avatar">
                  <AvatarImage src={user.profilePictureUrl || undefined} alt={user.name} />
                  <AvatarFallback className="text-4xl">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold" data-testid="profile-name">{user.name}</h1>
                  <p className="text-muted-foreground" data-testid="profile-title">
                    {user.bio || 'Professional • EchoMateLite Member'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1" data-testid="profile-location">
                    San Francisco, CA • 500+ connections
                  </p>
                </div>
                <Button className="px-4 py-2" data-testid="button-edit-profile">
                  Edit Profile
                </Button>
              </div>

              {/* Bio */}
              <div className="mb-6">
                <p className="text-foreground leading-relaxed" data-testid="profile-bio">
                  {user.bio || 'Passionate about creating amazing experiences and connecting with professionals worldwide. Building the future one project at a time.'}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-border">
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="profile-followers">247</p>
                  <p className="text-sm text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="profile-following">189</p>
                  <p className="text-sm text-muted-foreground">Following</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="profile-posts">{userPosts?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Posts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="glass-effect rounded-2xl p-2 mb-6">
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'posts' ? 'default' : 'ghost'}
                className="flex-1"
                onClick={() => setActiveTab('posts')}
                data-testid="tab-posts"
              >
                Posts
              </Button>
              <Button
                variant={activeTab === 'about' ? 'default' : 'ghost'}
                className="flex-1"
                onClick={() => setActiveTab('about')}
                data-testid="tab-about"
              >
                About
              </Button>
              <Button
                variant={activeTab === 'media' ? 'default' : 'ghost'}
                className="flex-1"
                onClick={() => setActiveTab('media')}
                data-testid="tab-media"
              >
                Media
              </Button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'posts' && (
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
                  <p className="text-muted-foreground" data-testid="text-no-user-posts">No posts yet. Share your first thought!</p>
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

          {activeTab === 'about' && (
            <div className="glass-effect rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-4">About</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-muted-foreground mb-2">Bio</h4>
                  <p className="text-foreground" data-testid="about-bio">
                    {user.bio || 'No bio provided yet.'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground mb-2">Email</h4>
                  <p className="text-foreground" data-testid="about-email">{user.email}</p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground mb-2">Joined</h4>
                  <p className="text-foreground" data-testid="about-joined">
                    {new Date(user.createdAt!).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'media' && (
            <div className="glass-effect rounded-2xl p-6 text-center">
              <p className="text-muted-foreground" data-testid="text-no-media">No media shared yet.</p>
            </div>
          )}
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
