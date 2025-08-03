# Complete List of ALL Code Changes Required

## 🚨 CRITICAL: Full Migration Checklist

After thorough analysis, here are ALL files that need changes for the migration:

## 1. Server-Side Changes

### Replace Core Files:
```bash
# Main server files
mv server/index.vercel.ts server/index.ts
mv server/routes.vercel.ts server/routes.ts
mv server/clerkAuth.ts server/auth.ts  # New auth system
mv server/emailService.vercel.ts server/emailService.ts
```

### Add New Methods to Existing Files:
**File: `server/storage.ts`**
- Add methods from `server/storage.vercel.ts`:
  - `updateUserClerkId(oldId, newClerkId)`
  - `reconcileUserSession(userId, email)`

## 2. Frontend Changes

### Replace Core Files:
```bash
# Main frontend files
mv client/src/App.clerk.tsx client/src/App.tsx
mv client/src/hooks/useAuth.clerk.ts client/src/hooks/useAuth.ts
mv client/src/components/Navigation.clerk.tsx client/src/components/Navigation.tsx
mv client/src/components/ProtectedRoute.clerk.tsx client/src/components/ProtectedRoute.tsx
mv client/src/pages/Logout.clerk.tsx client/src/pages/Logout.tsx
```

### Add New Files:
- ✅ `client/src/components/ClerkProvider.tsx`
- ✅ `client/src/pages/SignIn.tsx`
- ✅ `client/src/pages/SignUp.tsx`

## 3. Configuration Changes

### Replace Config Files:
```bash
mv package.json.new package.json
mv client/vite.config.ts client/vite.config.ts  # Already updated
```

### Remove Replit-Specific Files:
- `server/replitAuth.ts` (keep as backup, don't use)
- `server/directAuth.ts` (functionality moved to clerkAuth.ts)

## 4. Environment Variable Updates

### In Vercel Dashboard - Remove These:
```
REPL_ID
REPLIT_DOMAINS
ISSUER_URL
```

### In Vercel Dashboard - Add These:
```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Keep These (Update Values):
```
DATABASE_URL=postgresql://... (new Vercel Postgres)
SESSION_SECRET=your-session-secret
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
NODE_ENV=production
```

## 5. Files with Replit References to Update

### These files contain hard-coded Replit references:
1. **`server/routes.ts`** line 1041:
   - Replace `process.env.REPLIT_DOMAINS` with `process.env.NEXT_PUBLIC_APP_URL`

2. **`server/emailTemplates.tsx`**:
   - Replace `https://yourapp.replit.app` with `${process.env.NEXT_PUBLIC_APP_URL}`

3. **`attached_assets/weekly-nudge-email_1751190164493.ts`**:
   - Replace Replit URLs with Vercel URLs (if still using)

4. **`vite.config.ts`**:
   - Remove Replit plugins and REPL_ID references

5. **`server/test/setup.ts`**:
   - Update test environment variables

## 6. Database Schema Updates

### Add to storage methods (already prepared):
```typescript
// In server/storage.ts - add these methods:
async updateUserClerkId(oldId: string, newClerkId: string)
async reconcileUserSession(userId: string, email: string)
```

## 7. Import Statement Updates

### Files that import removed modules:
- Any file importing `./replitAuth` → change to `./clerkAuth`
- Any file importing old `useAuth` → already handled in replacements

## 8. Route Updates

### Update API endpoints in `server/routes.vercel.ts`:
- Replace all `isAuthenticated` → `requireAuth, syncUser`
- Update `req.user.claims.sub` → `req.auth.userId`
- Update admin checks to use `req.dbUser?.isAdmin`

## 9. Test File Updates

### Files that need test updates:
- `server/test/setup.ts` - Remove Replit environment variables
- All test files using auth - Update to use Clerk patterns

## 10. Build Configuration

### Already prepared:
- ✅ `vercel.json` - Vercel deployment config
- ✅ Updated `package.json` with Clerk dependencies
- ✅ Updated Vite config without Replit plugins

## Migration Process Summary

### Phase 1: File Replacements (5 minutes)
```bash
# Replace all core files with Clerk versions
mv server/index.vercel.ts server/index.ts
mv server/routes.vercel.ts server/routes.ts
mv client/src/App.clerk.tsx client/src/App.tsx
mv client/src/hooks/useAuth.clerk.ts client/src/hooks/useAuth.ts
mv client/src/components/Navigation.clerk.tsx client/src/components/Navigation.tsx
mv client/src/components/ProtectedRoute.clerk.tsx client/src/components/ProtectedRoute.tsx
mv client/src/pages/Logout.clerk.tsx client/src/pages/Logout.tsx
mv package.json.new package.json
```

### Phase 2: Install Dependencies (2 minutes)
```bash
npm install @clerk/nextjs @clerk/clerk-sdk-node
```

### Phase 3: Manual Updates (10 minutes)
1. Add storage methods to `server/storage.ts`
2. Update email service URL references
3. Update environment variables in Vercel

### Phase 4: Deploy and Test (30 minutes)
1. Deploy to Vercel
2. Test all authentication flows
3. Verify all features work

## Critical Success Points

### Must Work After Migration:
- ✅ User sign-in/sign-up via Clerk
- ✅ All protected routes accessible
- ✅ Team member management
- ✅ AI coach functionality
- ✅ Email system with correct URLs
- ✅ Admin panel access
- ✅ Database operations

### Known Potential Issues:
1. **Email URLs**: Must use `NEXT_PUBLIC_APP_URL` instead of `REPLIT_DOMAINS`
2. **Admin Access**: Admin users identified by database flag + email check
3. **Session Management**: Clerk handles differently than Replit
4. **User ID Migration**: Existing users need ID reconciliation

## Rollback Plan

If migration fails:
1. Keep original Replit version running
2. Revert file changes via Git
3. Restore original environment variables
4. Keep database backup for restoration

## Files Created and Ready:
- ✅ All replacement files created with `.vercel` or `.clerk` extensions
- ✅ All configuration files ready
- ✅ Migration documentation complete
- ✅ Environment variable mapping ready

**TOTAL ESTIMATED TIME: 45 minutes for file changes + testing**

Ready to execute the migration when you are!