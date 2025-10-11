import {
  users,
  posts,
  postLikes,
  postComments,
  follows,
  notifications,
  type User,
  type InsertUser,
  type Post,
  type InsertPost,
  type PostLike,
  type InsertPostLike,
  type PostComment,
  type InsertPostComment,
  type PostWithAuthor,
  type Follow,
  type Notification,
  type NotificationWithActor,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser, cognitoUserId?: string): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  // Post methods
  getPosts(
    userId: string,
    limit?: number,
    offset?: number,
    tag?: string
  ): Promise<PostWithAuthor[]>;
  getPost(id: string): Promise<Post | undefined>;
  getPostWithAuthor(
    id: string,
    currentUserId: string
  ): Promise<PostWithAuthor | undefined>;
  getUserPosts(
    userId: string,
    currentUserId: string
  ): Promise<PostWithAuthor[]>;
  createPost(insertPost: InsertPost): Promise<Post>;
  updatePostContent(id: string, content: string): Promise<Post>;
  deletePost(id: string): Promise<void>;

  // Like methods
  getPostLike(postId: string, userId: string): Promise<PostLike | undefined>;
  createPostLike(insertLike: InsertPostLike): Promise<PostLike>;
  deletePostLike(postId: string, userId: string): Promise<void>;
  getPostLikeUsers(postId: string): Promise<User[]>;

  // Comment methods
  getPostComments(postId: string): Promise<Array<PostComment & { user: User }>>;
  getCommentWithUser(
    commentId: string
  ): Promise<(PostComment & { user: User }) | undefined>;
  createPostComment(insertComment: InsertPostComment): Promise<PostComment>;

  // Follow methods
  follow(followerId: string, followingId: string): Promise<Follow>;
  unfollow(followerId: string, followingId: string): Promise<void>;
  getFollowCounts(
    userId: string
  ): Promise<{ followers: number; following: number }>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getFollowers(userId: string): Promise<User[]>;
  getFollowing(userId: string): Promise<User[]>;
  // Discoverability
  getTrendingTopics(
    limit?: number
  ): Promise<Array<{ tag: string; count: number }>>;
  getUserSuggestions(
    currentUserId: string,
    limit?: number
  ): Promise<Array<User & { followers: number }>>;

  // Notification methods
  createNotification(data: {
    userId: string;
    actorId: string;
    type: string;
    postId?: string;
    commentId?: string;
  }): Promise<Notification>;
  getNotifications(userId: string): Promise<NotificationWithActor[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(
    insertUser: InsertUser,
    cognitoUserId?: string
  ): Promise<User> {
    const userData = cognitoUserId
      ? { ...insertUser, id: cognitoUserId }
      : insertUser;
    const [user] = await db
      .insert(users)
      .values(userData as any)
      .returning();
    return user;
  }

  async updateUser(
    id: string,
    data: Partial<InsertUser>
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Post methods
  async getPosts(
    userId: string,
    limit = 20,
    offset = 0,
    tag?: string
  ): Promise<PostWithAuthor[]> {
    // If tag is provided, fetch all posts first and filter by tag
    // This matches the logic used in getTrendingTopics
    if (tag) {
      const tagWithHash = `#${tag.toLowerCase()}`;
      const hashtagRegex = /#[A-Za-z0-9_]+/g;

      const allPostsData = await db
        .select()
        .from(posts)
        .orderBy(desc(posts.createdAt));

      // Filter posts that contain the tag
      const filteredPosts = allPostsData.filter((post) => {
        if (!post.content) return false;
        const matches = post.content.match(hashtagRegex) || [];
        const lowercaseTags = matches.map((m) => m.toLowerCase());
        return lowercaseTags.includes(tagWithHash);
      });

      // Apply limit and offset after filtering
      const paginatedPosts = filteredPosts.slice(offset, offset + limit);

      const postsWithDetails = await Promise.all(
        paginatedPosts.map(async (post) => {
          const [author] = await db
            .select()
            .from(users)
            .where(eq(users.id, post.userId));
          const likes = await db
            .select()
            .from(postLikes)
            .where(eq(postLikes.postId, post.id));
          const comments = await db
            .select()
            .from(postComments)
            .where(eq(postComments.postId, post.id));
          const isLiked = likes.some((like) => like.userId === userId);

          return {
            ...post,
            author,
            likes,
            comments,
            isLiked,
          };
        })
      );

      return postsWithDetails;
    }

    // No tag filter - use normal pagination
    const postsData = await db
      .select()
      .from(posts)
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    const postsWithDetails = await Promise.all(
      postsData.map(async (post) => {
        const [author] = await db
          .select()
          .from(users)
          .where(eq(users.id, post.userId));
        const likes = await db
          .select()
          .from(postLikes)
          .where(eq(postLikes.postId, post.id));
        const comments = await db
          .select()
          .from(postComments)
          .where(eq(postComments.postId, post.id));
        const isLiked = likes.some((like) => like.userId === userId);

        return {
          ...post,
          author,
          likes,
          comments,
          isLiked,
        };
      })
    );

    return postsWithDetails;
  }

  async getPost(id: string): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post || undefined;
  }

  async getPostWithAuthor(
    id: string,
    currentUserId: string
  ): Promise<PostWithAuthor | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    if (!post) return undefined;

    const [author] = await db
      .select()
      .from(users)
      .where(eq(users.id, post.userId));
    const likes = await db
      .select()
      .from(postLikes)
      .where(eq(postLikes.postId, post.id));
    const comments = await db
      .select()
      .from(postComments)
      .where(eq(postComments.postId, post.id));
    const isLiked = likes.some((like) => like.userId === currentUserId);

    return {
      ...post,
      author,
      likes,
      comments,
      isLiked,
    };
  }

  async getUserPosts(
    userId: string,
    currentUserId: string
  ): Promise<PostWithAuthor[]> {
    const postsData = await db
      .select()
      .from(posts)
      .where(eq(posts.userId, userId))
      .orderBy(desc(posts.createdAt));

    const postsWithDetails = await Promise.all(
      postsData.map(async (post) => {
        const [author] = await db
          .select()
          .from(users)
          .where(eq(users.id, post.userId));
        const likes = await db
          .select()
          .from(postLikes)
          .where(eq(postLikes.postId, post.id));
        const comments = await db
          .select()
          .from(postComments)
          .where(eq(postComments.postId, post.id));
        const isLiked = likes.some((like) => like.userId === currentUserId);

        return {
          ...post,
          author,
          likes,
          comments,
          isLiked,
        };
      })
    );

    return postsWithDetails;
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(insertPost).returning();
    return post;
  }

  async updatePostContent(id: string, content: string): Promise<Post> {
    const [postRow] = await db
      .update(posts)
      .set({ content, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return postRow as Post;
  }

  async deletePost(id: string): Promise<void> {
    // Delete dependent rows first to satisfy foreign key constraints
    await db.delete(postLikes).where(eq(postLikes.postId, id));
    await db.delete(postComments).where(eq(postComments.postId, id));
    await db.delete(posts).where(eq(posts.id, id));
  }

  // Like methods
  async getPostLike(
    postId: string,
    userId: string
  ): Promise<PostLike | undefined> {
    const [like] = await db
      .select()
      .from(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
    return like || undefined;
  }

  async createPostLike(insertLike: InsertPostLike): Promise<PostLike> {
    const [like] = await db.insert(postLikes).values(insertLike).returning();
    return like;
  }

  async deletePostLike(postId: string, userId: string): Promise<void> {
    await db
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
  }

  async getPostLikeUsers(postId: string): Promise<User[]> {
    const likes = await db
      .select()
      .from(postLikes)
      .where(eq(postLikes.postId, postId));

    const userIds = likes.map((like) => like.userId);
    if (userIds.length === 0) return [];

    const likeUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));

    return likeUsers;
  }

  // Comment methods
  async getPostComments(
    postId: string
  ): Promise<Array<PostComment & { user: User }>> {
    const commentsData = await db
      .select()
      .from(postComments)
      .where(eq(postComments.postId, postId))
      .orderBy(desc(postComments.createdAt));

    const commentsWithUsers = await Promise.all(
      commentsData.map(async (comment) => {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, comment.userId));
        return {
          ...comment,
          user,
        };
      })
    );

    return commentsWithUsers;
  }

  async getCommentWithUser(
    commentId: string
  ): Promise<(PostComment & { user: User }) | undefined> {
    const [comment] = await db
      .select()
      .from(postComments)
      .where(eq(postComments.id, commentId));
    if (!comment) return undefined;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, comment.userId));

    return {
      ...comment,
      user,
    };
  }

  async createPostComment(
    insertComment: InsertPostComment
  ): Promise<PostComment> {
    const [comment] = await db
      .insert(postComments)
      .values(insertComment)
      .returning();
    return comment;
  }

  // Follow methods
  async follow(followerId: string, followingId: string): Promise<Follow> {
    const [row] = await db
      .insert(follows)
      .values({ followerId, followingId })
      .onConflictDoNothing()
      .returning();
    return row as Follow;
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );
  }

  async getFollowCounts(
    userId: string
  ): Promise<{ followers: number; following: number }> {
    const followersRows = await db
      .select()
      .from(follows)
      .where(eq(follows.followingId, userId));
    const followingRows = await db
      .select()
      .from(follows)
      .where(eq(follows.followerId, userId));
    return { followers: followersRows.length, following: followingRows.length };
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [row] = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );
    return !!row;
  }

  async getFollowers(userId: string): Promise<User[]> {
    const followRows = await db
      .select()
      .from(follows)
      .where(eq(follows.followingId, userId));

    const followerIds = followRows.map((f) => f.followerId);
    if (followerIds.length === 0) return [];

    const followers = await db
      .select()
      .from(users)
      .where(inArray(users.id, followerIds));

    return followers;
  }

  async getFollowing(userId: string): Promise<User[]> {
    const followRows = await db
      .select()
      .from(follows)
      .where(eq(follows.followerId, userId));

    const followingIds = followRows.map((f) => f.followingId);
    if (followingIds.length === 0) return [];

    const following = await db
      .select()
      .from(users)
      .where(inArray(users.id, followingIds));

    return following;
  }

  // Discoverability helpers
  async getTrendingTopics(
    limit = 5
  ): Promise<Array<{ tag: string; count: number }>> {
    const postsData = await db
      .select()
      .from(posts)
      .orderBy(desc(posts.createdAt));

    const hashtagCounts = new Map<string, number>();
    const hashtagRegex = /#[A-Za-z0-9_]+/g;
    for (const post of postsData) {
      if (!post.content) continue;
      const matches = post.content.match(hashtagRegex) || [];
      for (const raw of matches) {
        const tag = raw.toLowerCase();
        hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
      }
    }

    return Array.from(hashtagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getUserSuggestions(
    currentUserId: string,
    limit = 5
  ): Promise<Array<User & { followers: number }>> {
    const followingRows = await db
      .select()
      .from(follows)
      .where(eq(follows.followerId, currentUserId));
    const followingSet = new Set(followingRows.map((r) => r.followingId));

    const allFollows = await db.select().from(follows);
    const followerCountByUser = new Map<string, number>();
    for (const f of allFollows) {
      followerCountByUser.set(
        f.followingId,
        (followerCountByUser.get(f.followingId) || 0) + 1
      );
    }

    const allUsers = await db.select().from(users);
    return allUsers
      .filter((u) => u.id !== currentUserId && !followingSet.has(u.id))
      .map((u) => ({ ...u, followers: followerCountByUser.get(u.id) || 0 }))
      .sort((a, b) => b.followers - a.followers)
      .slice(0, limit);
  }

  // Notification methods
  async createNotification(data: {
    userId: string;
    actorId: string;
    type: string;
    postId?: string;
    commentId?: string;
  }): Promise<Notification> {
    // Don't create notification if actor is the same as user
    if (data.userId === data.actorId) {
      throw new Error("Cannot create notification for self");
    }

    const [notification] = await db
      .insert(notifications)
      .values(data)
      .returning();
    return notification;
  }

  async getNotifications(userId: string): Promise<NotificationWithActor[]> {
    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    // Get all unique actor IDs
    const actorIdsSet = new Set<string>();
    notifs.forEach((n) => actorIdsSet.add(n.actorId));
    const actorIds = Array.from(actorIdsSet);

    // Get all actors
    const actors = await db
      .select()
      .from(users)
      .where(inArray(users.id, actorIds));

    const actorMap = new Map(actors.map((a) => [a.id, a]));

    // Get all unique post IDs for like/comment notifications
    const postIdsSet = new Set<string>();
    notifs.forEach((n) => {
      if (n.postId) postIdsSet.add(n.postId);
    });
    const postIds = Array.from(postIdsSet);

    // Get all posts
    const postList =
      postIds.length > 0
        ? await db.select().from(posts).where(inArray(posts.id, postIds))
        : [];

    const postMap = new Map(postList.map((p) => [p.id, p]));

    // Combine notifications with actors and posts
    return notifs.map((n) => ({
      ...n,
      actor: actorMap.get(n.actorId)!,
      post: n.postId ? postMap.get(n.postId) : undefined,
    }));
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );

    return result[0]?.count || 0;
  }
}

export const storage = new DatabaseStorage();
