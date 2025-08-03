# StrengthsOpen1 - Claude Context & Migration Guide

## Project Overview
StrengthsOpen1 is a comprehensive team management and CliftonStrengths coaching platform that helps managers understand and leverage their team members' individual strengths for improved team dynamics and performance.

## Current Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, Wouter routing, shadcn/ui, Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit OIDC (NEEDS MIGRATION)
- **AI**: OpenAI GPT-4 integration
- **Email**: Resend service
- **Current Hosting**: Replit (MIGRATING TO VERCEL)

## Project Structure
```
StrengthsOpen1/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/             # Route components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and configurations
│   │   ├── test/              # Frontend tests
│   │   └── utils/             # Frontend utilities
├── server/                     # Express backend
│   ├── index.ts               # Main server entry point
│   ├── routes.ts              # API route definitions
│   ├── replitAuth.ts          # ⚠️ NEEDS REPLACEMENT
│   ├── directAuth.ts          # ⚠️ NEEDS REPLACEMENT
│   ├── db.ts                  # Database connection
│   ├── openai.ts              # AI integration
│   ├── emailService.ts        # Email functionality
│   └── test/                  # Backend tests
├── shared/                     # Shared code
│   └── schema.ts              # Database schema
├── migrations/                 # Database migrations
├── scripts/                   # Utility scripts
└── package.json               # Dependencies and scripts
```

## Key Features
1. **Team Management**: CRUD operations for team members with CliftonStrengths tracking
2. **AI Coaching**: GPT-4 powered personalized coaching insights and conversations
3. **Strengths Encyclopedia**: Comprehensive CliftonStrengths reference with search
4. **Email Coaching**: 12-week automated coaching email series with timezone handling
5. **Analytics Dashboard**: Visual team insights and performance tracking
6. **Admin Panel**: User management and system administration

## Environment Variables (Current Replit Setup)
```bash
# Database
DATABASE_URL=postgresql://...  # Neon PostgreSQL

# Replit Authentication (NEEDS REPLACEMENT)
REPL_ID=your-repl-id
REPLIT_DOMAINS=repl-domain.com
ISSUER_URL=https://replit.com/oidc

# AI & Services
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...

# Application
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-session-secret
```

## Key Commands
```bash
# Development
npm run dev              # Start development servers
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:push         # Push schema changes to database
npm run db:fix-admin    # Fix admin user issues
npm run db:analyze      # Analyze database

# Testing
npm test                # Run all tests
npm run test:client     # Run client tests only
npm run test:server     # Run server tests only

# Utilities
npm run backup:full     # Full database backup
npm run emergency:investigate  # Emergency user investigation
```

## Database Schema (PostgreSQL with Drizzle)
- **users**: User profiles and authentication data
- **sessions**: Session storage for authentication
- **team_members**: Team member profiles with CliftonStrengths data
- **conversations**: AI coaching conversation history
- **messages**: Individual conversation messages
- **conversation_backups**: Backup storage for conversations
- **email_subscriptions**: Email coaching preferences and scheduling
- **email_logs**: Email delivery tracking and metrics
- **email_metrics**: Email performance analytics
- **unsubscribe_tokens**: Secure unsubscription management
- **openai_usage_logs**: AI API usage tracking and billing

## Migration Status: Replit → Vercel

### ✅ Ready for Migration (No Changes Needed)
- React frontend components and structure
- Database schema and Drizzle ORM setup
- OpenAI integration
- Email service (Resend)
- Most utility functions and business logic
- Test suites

### ⚠️ Needs Migration Changes
1. **Authentication System** (Critical)
   - Replace `server/replitAuth.ts` with Clerk or Auth0
   - Update `server/directAuth.ts` for new auth system
   - Modify frontend auth hooks and components
   - Update session management

2. **Environment Variables**
   - Remove Replit-specific variables
   - Add Vercel/Clerk configuration
   - Update database connection for Vercel Postgres

3. **Build Configuration**
   - Add `vercel.json` configuration
   - Update scripts for Vercel deployment
   - Configure monorepo structure

4. **Database Migration**
   - Export data from current Neon database
   - Set up Vercel Postgres
   - Import data and run migrations

### 🔄 Files That Need Modification

#### Server Files
- `server/replitAuth.ts` → Replace with Clerk auth
- `server/directAuth.ts` → Update for new auth system
- `server/index.ts` → Update auth middleware
- `server/routes.ts` → Update auth-protected routes

#### Frontend Files
- `client/src/hooks/useAuth.ts` → Update for new auth provider
- `client/src/pages/AdminLogin.tsx` → Update login flow
- `client/src/components/Navigation.tsx` → Update auth UI
- `client/src/lib/authUtils.ts` → Update auth utilities

#### Configuration Files
- Add `vercel.json` → Vercel deployment configuration
- Update `package.json` → Add Clerk dependencies
- Update environment variables → New auth configuration

## Migration Plan Overview

### Phase 1: Preparation
1. Set up Vercel account and import project
2. Configure Vercel project settings
3. Set up Vercel Postgres database

### Phase 2: Authentication Migration
1. Install and configure Clerk
2. Replace authentication system
3. Update frontend auth components
4. Test authentication flow

### Phase 3: Deployment & Testing
1. Configure environment variables
2. Deploy to Vercel
3. Migrate database data
4. Test all functionality
5. Update DNS (if needed)

## Important Notes for Migration
- Current app uses session-based auth with PostgreSQL storage
- Admin bypass system exists with hardcoded email: `tinymanagerai@gmail.com`
- Email system is timezone-aware and requires proper configuration
- AI coaching system tracks usage for billing purposes
- File upload functionality exists for team member data import

## Post-Migration Tasks
1. Test all authentication flows
2. Verify email delivery system
3. Test AI coaching functionality
4. Validate database migrations
5. Monitor performance and error rates
6. Update documentation with new deployment process

## Development Workflow (Post-Migration)
1. Make changes locally
2. Commit to GitHub
3. Vercel auto-deploys from main branch
4. Use Vercel dashboard for monitoring and logs
5. Use Vercel Postgres dashboard for database management

## Troubleshooting Common Issues
- **Auth Issues**: Check Clerk configuration and environment variables
- **Database Issues**: Verify Vercel Postgres connection string
- **Build Issues**: Check Vercel logs and ensure all dependencies are installed
- **Email Issues**: Verify Resend API key and domain configuration