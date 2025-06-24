# Strengths Manager Application

## Overview

The Strengths Manager is a full-stack web application designed to help managers and teams understand and leverage CliftonStrengths for better team dynamics and performance. The application provides tools for team member management, strengths encyclopedia, AI-powered coaching insights, and comprehensive team analytics.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Authentication**: Session-based authentication integrated with Replit Auth

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Database Provider**: Neon serverless PostgreSQL
- **Authentication**: Replit OpenID Connect (OIDC) with Passport.js
- **Session Management**: Express sessions with PostgreSQL store
- **AI Integration**: OpenAI GPT-4o for generating team insights and coaching

### Key Components

1. **Authentication System**
   - Replit Auth integration with OIDC
   - Session-based authentication with PostgreSQL session store
   - User profile management with onboarding flow

2. **Team Management**
   - CRUD operations for team members
   - CliftonStrengths assignment and tracking
   - Team composition analysis

3. **Strengths Encyclopedia**
   - Complete CliftonStrengths reference with detailed descriptions
   - Domain categorization (Executing, Influencing, Relationship Building, Strategic Thinking)
   - Search and filtering capabilities

4. **AI Coach**
   - OpenAI-powered insights generation
   - Team strengths analysis and recommendations
   - Personalized coaching suggestions

5. **Dashboard**
   - Team overview with strengths distribution
   - Visual analytics and insights
   - Quick access to key features

## Data Flow

1. **User Authentication**: Users authenticate via Replit Auth, creating or updating user records in PostgreSQL
2. **Onboarding**: New users complete strengths selection and profile setup
3. **Team Management**: Managers add team members with their respective strengths
4. **AI Analysis**: Team data is processed through OpenAI API to generate insights
5. **Dashboard Display**: Aggregated data and insights are presented in the dashboard interface

## External Dependencies

### Core Dependencies
- **Database**: Neon serverless PostgreSQL for data persistence
- **Authentication**: Replit Auth service for user authentication
- **AI Services**: OpenAI API for generating insights and coaching content
- **UI Components**: Radix UI for accessible component primitives

### Development Tools
- **Build Tool**: Vite for fast development and optimized builds
- **Database Migrations**: Drizzle Kit for schema management
- **Type Safety**: TypeScript throughout the application stack

## Deployment Strategy

### Development Environment
- **Platform**: Replit with integrated PostgreSQL database
- **Hot Reload**: Vite dev server with HMR for frontend changes
- **Database**: Local development uses the same Neon database instance

### Production Deployment
- **Platform**: Replit Autoscale deployment
- **Build Process**: Vite builds frontend assets, esbuild bundles server code
- **Environment Variables**: 
  - `DATABASE_URL` for PostgreSQL connection
  - `OPENAI_API_KEY` for AI features
  - `SESSION_SECRET` for session encryption
  - `REPL_ID` and other Replit-specific variables

### Database Schema
- **Users Table**: Stores user profiles, onboarding status, and top strengths
- **Team Members Table**: Manages team member information and their strengths
- **Sessions Table**: Handles session persistence for authentication

## Recent Changes
- June 24, 2025: Fixed "New Chat" button focus issue by adding proper setTimeout delay to ensure focus happens after React state updates complete
- June 24, 2025: Fixed user message display by using hardcoded colors instead of CSS variables, added proper message rendering with unique keys, fixed delete button positioning to stay within sidebar bounds, and ensured all conversation messages display correctly
- June 24, 2025: Fixed conversation loading issue by implementing getConversationWithMessages method, improved authentication middleware to handle session edge cases, added comprehensive error logging and user feedback for conversation operations, and optimized database queries for message retrieval
- June 24, 2025: Fixed markdown rendering in AI responses with proper formatting for headers, bold text, numbered lists, and bullet points using custom HTML transformation
- June 24, 2025: Fixed header layout spacing between hamburger menu and title using inline styles to override CSS conflicts
- June 24, 2025: Fixed mobile experience for AI chat - resolved duplicate hamburger menu issue by hiding navigation menu button on chat page, added desktop sidebar toggle button for full-screen access to chat history, improved sidebar interactions with proper touch targets and smooth transitions, optimized keyboard input with proper sizing and viewport handling, enhanced message display with better spacing and readability, added mobile-specific CSS optimizations for touch devices, implemented proper mobile overlay behavior with full-screen coverage, and added viewport height handling for mobile keyboards
- June 24, 2025: Implemented robust error handling for AI chat system - added error boundaries for chat components, retry mechanisms for failed API calls, clear error states with actionable recovery options, and comprehensive error categorization with specific troubleshooting guidance
- June 24, 2025: Implemented database persistence for chat conversations replacing localStorage - added conversation and message tables, migration system for existing localStorage data, corruption recovery mechanisms, and comprehensive backup/restore functionality
- June 24, 2025: Fixed resource cleanup loops causing memory leaks - reduced cleanup interval from 30s to 5min, implemented smart cleanup that only processes expired resources, fixed useEffect dependency loops in ChatCoach component, added proper timeout management using useCleanup hook
- June 24, 2025: Fixed navigation overlap issue where "Team Dashboard" heading was cut off by the fixed navigation bar
- June 24, 2025: Restored original dashboard design by removing inline styles and ensuring CSS classes work properly
- June 24, 2025: Fixed AI insight generation functions in the dashboard - both team insights and collaboration insights now work correctly
- June 24, 2025: Fixed navigation menu routing issues by adding fallback navigation mechanism for Encyclopedia and AI Coach pages
- June 24, 2025: Fixed navigation overlap issues on Encyclopedia and AI Coach pages by adding proper top padding
- June 24, 2025: Fixed chat input field styling to span full width in AI Coach interface
- June 24, 2025: Fixed chat message styling and added markdown parsing for proper text formatting in AI Coach
- June 24, 2025: Implemented AI coaching system with expert strengths-based leadership coaching personality and deep CliftonStrengths knowledge
- June 23, 2025: Fixed critical React hooks error by removing "use client" directives from all UI components
- June 23, 2025: Enhanced database connection stability with optimized pool settings for Neon serverless
- June 23, 2025: Added retry logic for database operations to handle connection terminations
- June 23, 2025: Improved authentication route protection for all protected pages
- June 23, 2025: Fixed session store configuration issues with proper table handling and corruption prevention
- June 23, 2025: Implemented cryptographically secure UUID generation using Node.js crypto module with proper UUID v4 formatting
- June 23, 2025: Fixed authentication route protection gaps with comprehensive ProtectedRoute and PublicRoute components
- June 23, 2025: Added onboarding requirement checks for protected features and API endpoints
- June 23, 2025: Implemented comprehensive file upload security with malicious content scanning, strict validation, and input sanitization
- June 23, 2025: Fixed performance issues with unnecessary re-renders by implementing memoization, optimized queries, and cached expensive calculations
- June 23, 2025: Fixed memory leaks in OCR processing with comprehensive resource management, worker pooling, and automatic cleanup systems
- June 23, 2025: Implemented standardized API error handling with consistent response formats, detailed validation errors, and improved debugging capabilities
- June 23, 2025: Optimized database performance with enhanced connection pooling, strategic indexing, caching layer, and bulk operations to prevent N+1 queries

## User Preferences

Preferred communication style: Simple, everyday language.
User expects efficient solutions completed in fewer iterations, not incremental debugging.