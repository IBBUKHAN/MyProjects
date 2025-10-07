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

// JWT configuration
const JWT_SECRET = process.env.SESSION_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "24h";

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// JWT middleware
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      res.json({
        user: userWithoutPassword,
        token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);

      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        return res
          .status(401)
          .json({ message: "Incorrect email or password. Please try again." });
      }

      const isValidPassword = await bcrypt.compare(
        validatedData.password,
        user.password
      );
      if (!isValidPassword) {
        return res
          .status(401)
          .json({ message: "Incorrect email or password. Please try again." });
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      res.json({
        user: userWithoutPassword,
        token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    const { password, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
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
          bio: z.string().optional(),
          profilePictureUrl: z.string().optional(),
        })
        .parse(req.body);

      const user = await storage.updateUser(req.params.id, updateData);
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
      const posts = await storage.getPosts(req.user.id);
      res.json(posts);
    } catch (error) {
      console.error("Get posts error:", error);
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
        res.json({ liked: true });
      }
    } catch (error) {
      console.error("Toggle like error:", error);
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

        // TODO: Implement S3 upload
        // For now, return a placeholder URL
        const imageUrl = `https://via.placeholder.com/150?text=${req.user.name}`;

        res.json({ url: imageUrl });
      } catch (error) {
        console.error("Upload profile picture error:", error);
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

        // TODO: Implement S3 upload
        // For now, return a placeholder URL
        const imageUrl = `https://via.placeholder.com/600x400?text=Post+Image`;

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

  const httpServer = createServer(app);
  return httpServer;
}
