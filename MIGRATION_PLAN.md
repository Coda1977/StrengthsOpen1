# StrengthsOpen1 → Vercel Migration Plan

## Migration Overview
Moving from Replit to Vercel with Clerk authentication replacement. This is a **comprehensive step-by-step plan** for non-developers.

## Pre-Migration Checklist
- ✅ Repository properly organized with client/, server/, shared/ structure
- ✅ Code analysis completed
- ✅ Authentication replacement strategy defined
- ⏳ Backup current database data
- ⏳ Set up Vercel account

## Phase 1: Vercel Setup (15 minutes - You do this)

### Step 1.1: Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your repositories

### Step 1.2: Import Project (DON'T DEPLOY YET)
1. Click "New Project" in Vercel dashboard
2. Find `StrengthsOpen1` repository
3. Click "Import"
4. **STOP** - Do not click "Deploy" yet
5. Note down your Vercel project URL (will be like `strengths-open1-xxx.vercel.app`)

## Phase 2: Database Setup (20 minutes - You do with guidance)

### Step 2.1: Set up Vercel Postgres
1. In your Vercel project dashboard, go to "Storage" tab
2. Click "Create Database" → "Postgres"
3. Choose a name: `strengthsopen-db`
4. Select region closest to your users
5. Click "Create"
6. **Save the connection details** (DATABASE_URL)

### Step 2.2: Backup Current Data (Critical!)
```bash
# We'll run this together - exports your current data
npm run backup:full
```

## Phase 3: Authentication Setup (30 minutes - We do together)

### Step 3.1: Set up Clerk Account
1. Go to [clerk.dev](https://clerk.dev)
2. Sign up with GitHub
3. Create new application: "StrengthsOpen1"
4. Choose authentication methods: Email + Google
5. Save the API keys (we'll need these)

### Step 3.2: Install Clerk Dependencies
```bash
npm install @clerk/nextjs @clerk/clerk-sdk-node
```

## Phase 4: Code Changes (45 minutes - We do together)

### Step 4.1: Replace Authentication Files
Files to modify:
- ✅ `server/replitAuth.ts` → Replace with Clerk auth
- ✅ `server/directAuth.ts` → Update for Clerk
- ✅ `server/index.ts` → Update auth middleware
- ✅ `client/src/hooks/useAuth.ts` → Update for Clerk
- ✅ `client/src/pages/AdminLogin.tsx` → Update login flow

### Step 4.2: Update Environment Variables
Replace Replit variables with Vercel/Clerk variables:

**Remove these:**
```
REPL_ID
REPLIT_DOMAINS  
ISSUER_URL
```

**Add these:**
```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
DATABASE_URL=postgresql://... (from Vercel)
```

## Phase 5: Vercel Configuration (15 minutes - We do together)

### Step 5.1: Create vercel.json
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "functions": {
    "server/index.ts": {
      "runtime": "nodejs18.x"
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/client/index.html"
    }
  ]
}
```

### Step 5.2: Update package.json Scripts
Add Vercel-specific build commands

## Phase 6: Deployment & Testing (30 minutes - We do together)

### Step 6.1: Configure Environment Variables in Vercel
1. Go to Vercel project → Settings → Environment Variables
2. Add all new environment variables
3. Set them for Production, Preview, and Development

### Step 6.2: First Deployment
1. Click "Deploy" in Vercel
2. Monitor build logs for errors
3. Fix any build issues together

### Step 6.3: Database Migration
1. Run Drizzle migrations on new database
2. Import backed up data
3. Test database connectivity

### Step 6.4: Test Authentication
1. Test login flow with Clerk
2. Test admin access
3. Verify user sessions work

## Phase 7: Post-Migration Testing (20 minutes)

### Step 7.1: Feature Testing
- ✅ User login/logout
- ✅ Dashboard access
- ✅ Team member management
- ✅ AI coaching chat
- ✅ Email functionality
- ✅ Admin panel access

### Step 7.2: Performance Verification
- ✅ Page load times
- ✅ API response times
- ✅ Database queries

## Phase 8: DNS & Domain (Optional - 15 minutes)

### Step 8.1: Custom Domain (If you have one)
1. Go to Vercel project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate

## Authentication Migration Details

### Current System (Replit)
- Uses OpenID Connect with Replit as provider
- Session-based authentication with PostgreSQL storage
- Admin bypass system with hardcoded email
- Complex domain resolution for different environments

### New System (Clerk)
- Modern authentication with React hooks
- Built-in session management
- Admin user management through Clerk dashboard
- Automatic domain handling

### Key Changes Required

#### 1. Server-Side Auth (`server/`)
**Replace `replitAuth.ts` with:**
- Clerk webhook handling
- Simplified session middleware
- User synchronization with database

**Update `directAuth.ts` with:**
- Clerk admin user verification
- Simplified admin access flow

#### 2. Client-Side Auth (`client/src/`)
**Update `useAuth.ts` with:**
- Clerk React hooks
- Simplified auth state management

**Update login components:**
- Replace custom login forms with Clerk components
- Update navigation with Clerk user button

## Environment Variable Mapping

| Current (Replit) | New (Vercel + Clerk) | Purpose |
|------------------|----------------------|---------|
| `REPL_ID` | ❌ Remove | Replit-specific |
| `REPLIT_DOMAINS` | ❌ Remove | Replit-specific |
| `ISSUER_URL` | ❌ Remove | OIDC endpoint |
| `SESSION_SECRET` | ✅ Keep | Session encryption |
| `DATABASE_URL` | ✅ Update | New Vercel Postgres |
| - | `CLERK_PUBLISHABLE_KEY` | Clerk frontend |
| - | `CLERK_SECRET_KEY` | Clerk backend |
| `OPENAI_API_KEY` | ✅ Keep | AI functionality |
| `RESEND_API_KEY` | ✅ Keep | Email service |

## Rollback Plan (If needed)

If something goes wrong:
1. **Keep Replit running** until migration is confirmed working
2. **Have database backup** ready to restore
3. **DNS can be reverted** quickly
4. **Code can be reverted** via Git

## Success Criteria

Migration is successful when:
- ✅ All users can log in via Clerk
- ✅ All features work identically
- ✅ Admin access functions properly
- ✅ Database data is intact
- ✅ Email system works
- ✅ AI coaching functions
- ✅ Performance is equal or better

## Estimated Timeline

| Phase | Duration | Who |
|-------|----------|-----|
| Vercel Setup | 15 min | You |
| Database Setup | 20 min | You + Claude |
| Auth Setup | 30 min | You + Claude |
| Code Changes | 45 min | Claude + You |
| Vercel Config | 15 min | Claude + You |
| Deployment | 30 min | Claude + You |
| Testing | 20 min | You + Claude |
| **Total** | **2h 55min** | **Together** |

## Risk Assessment

**Low Risk:**
- Vercel deployment (well-documented)
- Database migration (standard process)
- Email/AI services (no changes needed)

**Medium Risk:**
- Authentication replacement (but Clerk is reliable)
- Environment variable configuration

**Mitigation:**
- Keep Replit running during migration
- Test everything thoroughly before switching DNS
- Have rollback plan ready

## Next Steps

1. **You**: Set up Vercel account and import project (don't deploy)
2. **You**: Set up Vercel Postgres database
3. **You**: Set up Clerk account
4. **Together**: Start code modifications
5. **Together**: Deploy and test

Ready to begin? Let's start with Phase 1!