# EchoMateLite - Lightweight Social Media Platform

## Overview

EchoMateLite is a modern, lightweight social media platform inspired by LinkedIn's clean design aesthetic. Built with a focus on simplicity and performance, it enables users to create posts, interact through likes and comments, and maintain professional profiles. The application features a glassmorphism UI design with responsive layouts for desktop, tablet, and mobile devices.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tool**
- React with TypeScript for type-safe component development
- Vite as the build tool for fast development and optimized production builds
- Wouter for client-side routing (lightweight alternative to React Router)

**UI & Styling**
- TailwindCSS for utility-first styling with custom design tokens
- Shadcn UI components (New York style) for consistent, accessible UI primitives
- Glassmorphism design pattern with custom CSS variables for theme management
- Radix UI primitives for accessible, unstyled component foundations
- Framer Motion ready (imported in package.json) for animations

**State Management**
- Zustand for global state management (auth, theme)
- Zustand persist middleware for localStorage synchronization
- TanStack Query (React Query) for server state management, caching, and data fetching

**Design System**
- Custom color scheme with CSS variables supporting light/dark modes
- Inter font family as primary typeface
- Component aliases configured for clean imports (@/components, @/lib, etc.)

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for RESTful API
- ESM modules throughout the codebase
- HTTP server with custom logging middleware for API requests

**Database & ORM**
- PostgreSQL as the primary database
- Neon serverless PostgreSQL for cloud database hosting
- Drizzle ORM for type-safe database operations
- WebSocket support via ws package for Neon serverless connections

**Authentication & Security**
- JWT (JSON Web Tokens) for stateless authentication
- bcrypt.js for password hashing
- Token-based authentication with Bearer tokens
- Protected route middleware for secure endpoints

**Database Schema**
- Users table: id, email, password, name, bio, profilePictureUrl, createdAt
- Posts table: id, content, imageUrl, userId, createdAt, updatedAt
- Post Likes table: id, postId, userId, createdAt
- Post Comments table: id, postId, userId, content, createdAt
- Drizzle relations for type-safe joins and queries

**API Structure**
- RESTful endpoints organized by resource
- Authentication routes: /api/auth/register, /api/auth/login, /api/auth/me
- Post routes: /api/posts (GET, POST), /api/posts/:id, /api/posts/:id/like
- User routes: /api/users/:id/posts
- Standardized JSON responses with error handling

### File Upload & Storage

**File Handling**
- Multer middleware for multipart/form-data processing
- Memory storage strategy with 5MB file size limit
- Prepared for cloud storage integration (AWS S3 mentioned in project requirements)
- Support for profile pictures and post media uploads

### Development & Build Process

**Development Environment**
- Vite dev server with HMR (Hot Module Replacement)
- Replit-specific plugins for development banner and cartographer
- Runtime error overlay for better debugging
- TSX for TypeScript execution in development

**Build & Deployment**
- Vite builds frontend to dist/public
- esbuild bundles backend to dist/index.js
- ESM output format for both frontend and backend
- Production mode serves static files from Express

**Type Safety**
- Shared types between frontend and backend (@shared directory)
- Zod schemas for runtime validation
- Drizzle Zod integration for database schema validation
- TypeScript strict mode enabled

### Project Structure

```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/  # UI components (layout, post, ui primitives)
│   │   ├── pages/       # Route pages (home, login, register, profile)
│   │   ├── lib/         # Utilities (auth, queryClient, store, utils)
│   │   └── hooks/       # Custom React hooks
├── server/              # Backend Express application
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database access layer
│   ├── db.ts           # Database connection
│   └── vite.ts         # Vite integration for development
├── shared/              # Shared types and schemas
│   └── schema.ts       # Drizzle schema and Zod validators
└── migrations/         # Database migrations
```

## External Dependencies

### Cloud Services & Hosting
- **Neon Database**: Serverless PostgreSQL hosting
- **AWS S3**: Planned for media storage (profile images, post media)
- **Replit**: Development and deployment platform

### Core Libraries
- **@neondatabase/serverless**: PostgreSQL client for Neon
- **drizzle-orm**: Type-safe ORM
- **express**: Web server framework
- **jsonwebtoken**: JWT authentication
- **bcryptjs**: Password hashing

### Frontend Libraries
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight routing
- **react-hook-form**: Form handling
- **zod**: Schema validation
- **@hookform/resolvers**: Zod integration for react-hook-form

### UI Component Libraries
- **@radix-ui/react-***: Accessible UI primitives (40+ components)
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Tools
- **vite**: Build tool and dev server
- **typescript**: Type safety
- **drizzle-kit**: Database migration tool
- **esbuild**: Backend bundler