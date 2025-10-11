import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { storage } from "./storage";
import {
  loginSchema,
  registerSchema,
  insertPostSchema,
  insertPostCommentSchema,
} from "@shared/schema";
import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  registerWithCognito,
  loginWithCognito,
  verifyToken,
  confirmSignUp,
  resendConfirmationCode,
} from "./cognito";

// JWT configuration (keeping for backward compatibility)
const JWT_SECRET = process.env.SESSION_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "24h";

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// S3 client (optional; enabled when env vars are set)
console.log("====>>>>>", process.env.AWS_REGION, process.env.S3_BUCKET);
const s3 =
  process.env.AWS_REGION && process.env.S3_BUCKET
    ? new S3Client({
        region: process.env.AWS_REGION,
        credentials:
          process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
              }
            : undefined,
      })
    : undefined;

// Cognito authentication middleware
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    // Verify token with Cognito
    const cognitoUser = await verifyToken(token);

    // Get user from database using Cognito sub (user ID)
    const user = await storage.getUser(cognitoUser.sub);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).json({ message: "Invalid token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);

      // Check if user already exists in our database
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Register with AWS Cognito - Cognito will send verification email
      const cognitoResult = await registerWithCognito(
        validatedData.email,
        validatedData.password,
        validatedData.name
      );

      // Create user in our database with Cognito user ID
      const user = await storage.createUser(
        {
          email: cognitoResult.email,
          name: cognitoResult.name,
          password: "COGNITO_MANAGED", // Password is managed by Cognito
        },
        cognitoResult.userId // Pass Cognito user ID separately
      );

      // Return success - user needs to verify email before logging in
      res.json({
        message:
          "Registration successful! Please check your email for verification code.",
        email: cognitoResult.email,
        userId: cognitoResult.userId,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Registration error:", error);
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);

      // Authenticate with AWS Cognito
      const tokens = await loginWithCognito(
        validatedData.email,
        validatedData.password
      );

      // Verify token to get user info
      const cognitoUser = await verifyToken(tokens.accessToken);

      // Get user from our database
      const user = await storage.getUser(cognitoUser.sub);
      if (!user) {
        return res
          .status(401)
          .json({ message: "Incorrect email or password. Please try again." });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      res.json({
        user: userWithoutPassword,
        token: tokens.accessToken, // Return Cognito access token
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(401).json({
        message:
          error.message || "Incorrect email or password. Please try again.",
      });
    }
  });

  // Email verification endpoint
  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { email, code, password } = z
        .object({
          email: z.string().email(),
          code: z.string().min(1),
          password: z.string().min(1),
        })
        .parse(req.body);

      // Verify the OTP code with Cognito
      await confirmSignUp(email, code);

      // Automatically log the user in after successful verification
      const tokens = await loginWithCognito(email, password);

      // Verify token to get user info
      const cognitoUser = await verifyToken(tokens.accessToken);

      // Get user from our database
      const user = await storage.getUser(cognitoUser.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        message: "Email verified successfully!",
        success: true,
        user: userWithoutPassword,
        token: tokens.accessToken, // Return Cognito access token
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Verification error:", error);
      res.status(400).json({ message: error.message || "Verification failed" });
    }
  });

  // Resend verification code endpoint
  app.post("/api/auth/resend-code", async (req, res) => {
    try {
      const { email } = z
        .object({
          email: z.string().email(),
        })
        .parse(req.body);

      await resendConfirmationCode(email);

      res.json({
        message: "Verification code resent to your email.",
        success: true,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Resend code error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to resend code" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    const { password, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
  });

  app.post("/api/auth/logout", authenticateToken, async (req: any, res) => {
    try {
      // In a stateless JWT system, we just send success
      // The client will remove the token from localStorage
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User routes
  app.get("/api/users/:id", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      const counts = await storage.getFollowCounts(user.id);
      const isFollowing = await storage.isFollowing(req.user.id, user.id);
      res.json({
        ...userWithoutPassword,
        followers: counts.followers,
        following: counts.following,
        isFollowing,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/users/:id", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.id !== req.params.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updateData = z
        .object({
          name: z.string().optional(),
          bio: z.string().nullable().optional(),
          profilePictureUrl: z.string().nullable().optional(),
          birthday: z.string().nullable().optional(),
          education: z.string().nullable().optional(),
          country: z.string().nullable().optional(),
          city: z.string().nullable().optional(),
          contactNumber: z.string().nullable().optional(),
          coverImageUrl: z.string().nullable().optional(),
        })
        .parse(req.body);

      // Convert birthday string to Date if present
      const processedData: any = {
        ...updateData,
        birthday: updateData.birthday ? new Date(updateData.birthday) : null,
      };

      // Remove birthday if it wasn't in the original request
      if (!("birthday" in updateData)) {
        delete processedData.birthday;
      }

      const user = await storage.updateUser(req.params.id, processedData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      const counts = await storage.getFollowCounts(user.id);
      const isFollowing = await storage.isFollowing(req.user.id, user.id);
      res.json({
        ...userWithoutPassword,
        followers: counts.followers,
        following: counts.following,
        isFollowing,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Update user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Post routes
  app.get("/api/posts", authenticateToken, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const tag = (req.query.tag as string | undefined)
        ?.toLowerCase()
        ?.replace(/^#/, "");

      const posts = await storage.getPosts(req.user.id, limit, offset, tag);
      return res.json(posts);
    } catch (error) {
      console.error("Get posts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Discovery routes
  app.get("/api/trending", authenticateToken, async (_req: any, res) => {
    try {
      const topics = await storage.getTrendingTopics(5);
      res.json(topics);
    } catch (error) {
      console.error("Get trending error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/suggestions", authenticateToken, async (req: any, res) => {
    try {
      const suggestions = await storage.getUserSuggestions(req.user.id, 5);
      // hide passwords from payload
      const sanitized = suggestions.map(({ password, ...u }) => u);
      res.json(sanitized);
    } catch (error) {
      console.error("Get suggestions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/posts", authenticateToken, async (req: any, res) => {
    try {
      const validatedData = insertPostSchema.parse({
        ...req.body,
        userId: req.user.id,
      });

      const post = await storage.createPost(validatedData);
      const postWithAuthor = await storage.getPostWithAuthor(
        post.id,
        req.user.id
      );

      res.json(postWithAuthor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create post error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/posts/:id", authenticateToken, async (req: any, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      if (post.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const body = z.object({ content: z.string().min(1) }).parse(req.body);

      // Simple update via createPost schema is not provided; do manual SQL
      const updated = await storage.updatePostContent(
        req.params.id,
        body.content
      );
      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Update post error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/posts/:id", authenticateToken, async (req: any, res) => {
    try {
      const post = await storage.getPostWithAuthor(req.params.id, req.user.id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.json(post);
    } catch (error) {
      console.error("Get post error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/posts/:id", authenticateToken, async (req: any, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deletePost(req.params.id);
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Delete post error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Like routes
  app.post("/api/posts/:id/like", authenticateToken, async (req: any, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user.id;

      const existingLike = await storage.getPostLike(postId, userId);
      if (existingLike) {
        await storage.deletePostLike(postId, userId);
        res.json({ liked: false });
      } else {
        await storage.createPostLike({ postId, userId });

        // Create notification for post author
        const post = await storage.getPost(postId);
        if (post && post.userId !== userId) {
          try {
            await storage.createNotification({
              userId: post.userId,
              actorId: userId,
              type: "like",
              postId,
            });
          } catch (notifError) {
            console.error("Failed to create like notification:", notifError);
            // Don't fail the like action if notification fails
          }
        }

        res.json({ liked: true });
      }
    } catch (error) {
      console.error("Toggle like error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/posts/:id/likes", authenticateToken, async (req: any, res) => {
    try {
      const likeUsers = await storage.getPostLikeUsers(req.params.id);
      const sanitized = likeUsers.map(({ password, ...u }) => u);
      res.json(sanitized);
    } catch (error) {
      console.error("Get post likes error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Comment routes
  app.post(
    "/api/posts/:id/comments",
    authenticateToken,
    async (req: any, res) => {
      try {
        const validatedData = insertPostCommentSchema.parse({
          ...req.body,
          postId: req.params.id,
          userId: req.user.id,
        });

        const comment = await storage.createPostComment(validatedData);
        const commentWithUser = await storage.getCommentWithUser(comment.id);

        res.json(commentWithUser);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Create comment error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get(
    "/api/posts/:id/comments",
    authenticateToken,
    async (req: any, res) => {
      try {
        const comments = await storage.getPostComments(req.params.id);
        res.json(comments);
      } catch (error) {
        console.error("Get comments error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // File upload routes (for S3 integration)
  app.post(
    "/api/upload/profile-picture",
    authenticateToken,
    upload.single("image"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file provided" });
        }
        if (!s3 || !process.env.S3_BUCKET || !process.env.AWS_REGION) {
          return res.status(500).json({ message: "S3 is not configured" });
        }

        const bucket = process.env.S3_BUCKET;
        const key = `users/${req.user.id}/profile-${Date.now()}`;
        const contentType = req.file.mimetype || "application/octet-stream";

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: req.file.buffer,
            ContentType: contentType,
          })
        );

        const imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        // persist on user profile
        const updatedUser = await storage.updateUser(req.user.id, {
          profilePictureUrl: imageUrl,
        });
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        const { password, ...userWithoutPassword } = updatedUser;
        res.json({ url: imageUrl, user: userWithoutPassword });
      } catch (error) {
        console.error("Upload profile picture error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/upload/cover-image",
    authenticateToken,
    upload.single("image"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file provided" });
        }
        if (!s3 || !process.env.S3_BUCKET || !process.env.AWS_REGION) {
          return res.status(500).json({ message: "S3 is not configured" });
        }

        const bucket = process.env.S3_BUCKET;
        const key = `users/${req.user.id}/cover-${Date.now()}`;
        const contentType = req.file.mimetype || "application/octet-stream";

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: req.file.buffer,
            ContentType: contentType,
          })
        );

        const imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        // persist on user profile
        const updatedUser = await storage.updateUser(req.user.id, {
          coverImageUrl: imageUrl,
        });
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        const { password, ...userWithoutPassword } = updatedUser;
        res.json({ url: imageUrl, user: userWithoutPassword });
      } catch (error) {
        console.error("Upload cover image error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/upload/post-image",
    authenticateToken,
    upload.single("image"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file provided" });
        }
        if (!s3 || !process.env.S3_BUCKET || !process.env.AWS_REGION) {
          return res.status(500).json({ message: "S3 is not configured" });
        }

        const bucket = process.env.S3_BUCKET;
        const key = `posts/${req.user.id}/post-${Date.now()}`;
        const contentType = req.file.mimetype || "application/octet-stream";

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: req.file.buffer,
            ContentType: contentType,
          })
        );

        const imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        res.json({ url: imageUrl });
      } catch (error) {
        console.error("Upload post image error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // User posts route
  app.get("/api/users/:id/posts", authenticateToken, async (req: any, res) => {
    try {
      const posts = await storage.getUserPosts(req.params.id, req.user.id);
      res.json(posts);
    } catch (error) {
      console.error("Get user posts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Follow routes
  app.post(
    "/api/users/:id/follow",
    authenticateToken,
    async (req: any, res) => {
      try {
        const targetUserId = req.params.id;
        if (targetUserId === req.user.id) {
          return res
            .status(400)
            .json({ message: "You cannot follow yourself" });
        }
        await storage.follow(req.user.id, targetUserId);

        // Create notification for the followed user
        try {
          await storage.createNotification({
            userId: targetUserId,
            actorId: req.user.id,
            type: "follow",
          });
        } catch (notifError) {
          console.error("Failed to create follow notification:", notifError);
          // Don't fail the follow action if notification fails
        }

        const counts = await storage.getFollowCounts(targetUserId);
        res.json({ followers: counts.followers });
      } catch (error) {
        console.error("Follow user error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.delete(
    "/api/users/:id/follow",
    authenticateToken,
    async (req: any, res) => {
      try {
        const targetUserId = req.params.id;
        await storage.unfollow(req.user.id, targetUserId);
        const counts = await storage.getFollowCounts(targetUserId);
        res.json({ followers: counts.followers });
      } catch (error) {
        console.error("Unfollow user error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get(
    "/api/users/:id/followers",
    authenticateToken,
    async (req: any, res) => {
      try {
        const followers = await storage.getFollowers(req.params.id);
        const sanitized = followers.map(({ password, ...u }) => u);
        res.json(sanitized);
      } catch (error) {
        console.error("Get followers error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get(
    "/api/users/:id/following",
    authenticateToken,
    async (req: any, res) => {
      try {
        const following = await storage.getFollowing(req.params.id);
        const sanitized = following.map(({ password, ...u }) => u);
        res.json(sanitized);
      } catch (error) {
        console.error("Get following error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Notification routes
  app.get("/api/notifications", authenticateToken, async (req: any, res) => {
    try {
      const notifications = await storage.getNotifications(req.user.id);
      // Sanitize passwords from actors
      const sanitized = notifications.map((n) => ({
        ...n,
        actor: { ...n.actor, password: undefined },
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(
    "/api/notifications/unread-count",
    authenticateToken,
    async (req: any, res) => {
      try {
        const count = await storage.getUnreadNotificationCount(req.user.id);
        res.json({ count });
      } catch (error) {
        console.error("Get unread count error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.patch(
    "/api/notifications/:id/read",
    authenticateToken,
    async (req: any, res) => {
      try {
        await storage.markNotificationAsRead(req.params.id);
        res.json({ success: true });
      } catch (error) {
        console.error("Mark notification as read error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/notifications/mark-all-read",
    authenticateToken,
    async (req: any, res) => {
      try {
        await storage.markAllNotificationsAsRead(req.user.id);
        res.json({ success: true });
      } catch (error) {
        console.error("Mark all notifications as read error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
