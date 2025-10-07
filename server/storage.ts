import {
  users,
  posts,
  postLikes,
  postComments,
  follows,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  // Post methods
  getPosts(userId: string): Promise<PostWithAuthor[]>;
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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
  async getPosts(userId: string): Promise<PostWithAuthor[]> {
    const postsData = await db
      .select()
      .from(posts)
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
}

export const storage = new DatabaseStorage();
