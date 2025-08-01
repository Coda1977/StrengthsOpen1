# Strengths Manager Application

## Overview

The Strengths Manager is a full-stack web application designed to help managers and teams understand and leverage CliftonStrengths for improved team dynamics and performance. It provides tools for team member management, a strengths encyclopedia, AI-powered coaching insights, and comprehensive team analytics. The vision is to empower teams by providing a centralized platform to understand and apply individual and collective strengths, fostering better collaboration and productivity.

## User Preferences

Preferred communication style: Simple, everyday language.
User expects efficient solutions completed in fewer iterations, not incremental debugging.
User prefers simple, direct solutions over complex over-engineered implementations.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Framework**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS
- **Authentication**: Session-based, integrated with Replit Auth

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js (REST API)
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Replit OpenID Connect (Passport.js)
- **Session Management**: Express sessions (PostgreSQL store)
- **AI Integration**: OpenAI GPT-4o

### Key Features
- **Authentication System**: Replit Auth, session-based, user profile management.
- **Team Management**: CRUD operations for team members, CliftonStrengths tracking, team composition analysis.
- **Strengths Encyclopedia**: Comprehensive CliftonStrengths reference with search and filtering.
- **AI Coach**: OpenAI-powered insights, team analysis, personalized coaching suggestions.
- **Dashboard**: Team overview, visual analytics, quick access features.
- **Email System**: Integration with Resend for welcome emails and a 12-week coaching series, with timezone-aware delivery and subscription management.
- **Robust Error Handling**: Comprehensive error boundaries, retry mechanisms, and clear error states.
- **Optimized Performance**: Memoization, optimized queries, cached calculations, and message pagination for chat.
- **Mobile Responsiveness**: Optimized UI/UX for mobile devices across all features, including chat.

### Data Flow
User authentication, onboarding, team data input, AI analysis, and dashboard display.

### Deployment Strategy
- **Development**: Replit with integrated PostgreSQL, Vite dev server.
- **Production**: Replit Autoscale deployment, Vite for frontend, esbuild for server.

### Database Schema
Key tables include Users, Team Members, Sessions, Email Subscriptions, Email Logs, Conversations, Messages, and Conversation Backups. Secure UUID generation and robust connection stability are implemented.

## External Dependencies

- **Database**: Neon serverless PostgreSQL
- **Authentication**: Replit Auth service
- **AI Services**: OpenAI API
- **UI Components**: Radix UI
- **Email Delivery**: Resend
- **Build Tool**: Vite
- **Database Migrations**: Drizzle Kit
- **Type Safety**: TypeScript