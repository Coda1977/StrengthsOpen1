import { Request, Response, NextFunction, Express } from 'express';
import { ClerkExpressRequireAuth, ClerkExpressWithAuth, LooseAuthProp } from '@clerk/clerk-sdk-node';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { storage } from './storage';

// Extend Express Request to include auth
declare global {
  namespace Express {
    interface Request extends LooseAuthProp {}
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  // Enhanced session store configuration with health monitoring
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
    schemaName: 'public',
    pruneSessionInterval: 60 * 15, // 15 minutes
    disableTouch: false,
    errorLog: (err) => {
      console.error('[SESSION] Store error:', err);
      if (err.code) {
        console.error('[SESSION] Error code:', err.code);
      }
      if (err.detail) {
        console.error('[SESSION] Error detail:', err.detail);
      }
    },
  });

  // Add session store event handlers
  sessionStore.on('connect', () => {
    console.log('[SESSION] Store successfully connected to database');
  });

  sessionStore.on('disconnect', () => {
    console.log('[SESSION] Store disconnected from database');
  });

  console.log('[SESSION] Session store initialized successfully');
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    name: 'sessionId',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
      sameSite: 'lax',
    },
  });
}

// Sync Clerk user with our database
async function syncUserWithDatabase(clerkUser: any) {
  try {
    console.log('[CLERK] Syncing user with database:', {
      clerkId: clerkUser.id,
      email: clerkUser.emailAddresses?.[0]?.emailAddress,
      firstName: clerkUser.firstName
    });

    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      throw new Error('No email address found for user');
    }

    // Check if user exists by email first
    let user = await storage.getUserByEmail(email);
    
    if (!user) {
      // Create new user with Clerk ID
      user = await storage.upsertUser({
        id: clerkUser.id,
        email: email,
        firstName: clerkUser.firstName || 'User',
        lastName: clerkUser.lastName || '',
        profileImageUrl: clerkUser.imageUrl,
      });

      console.log('[CLERK] New user created:', {
        id: user.id,
        email: user.email,
        isNewUser: !user.hasCompletedOnboarding
      });

      // Send welcome email for new users
      if (!user.hasCompletedOnboarding) {
        try {
          const { emailService } = await import('./emailService');
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';
          
          await emailService.sendAuthorizationWelcomeEmail(
            email,
            clerkUser.firstName || 'User',
            appUrl
          );
          console.log(`[CLERK] Welcome email sent to new user: ${email}`);
        } catch (error) {
          console.error('[CLERK] Failed to send welcome email:', error);
        }
      }
    } else {
      // Update existing user with Clerk ID if needed
      if (user.id !== clerkUser.id) {
        console.log('[CLERK] Updating existing user with Clerk ID:', {
          oldId: user.id,
          newClerkId: clerkUser.id
        });
        
        // Update the user ID to match Clerk ID
        await storage.updateUserClerkId(user.id, clerkUser.id);
        user = await storage.getUser(clerkUser.id);
      }
    }
    
    return user;
  } catch (error) {
    console.error('[CLERK] Failed to sync user with database:', error);
    throw error;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Add request logging middleware
  app.use((req, res, next) => {
    if (req.path.includes('/api/')) {
      console.log(`[AUTH DEBUG] ${req.method} ${req.path}`, {
        hostname: req.hostname,
        host: req.get('host'),
        'x-forwarded-host': req.get('x-forwarded-host'),
        'x-forwarded-proto': req.get('x-forwarded-proto'),
        origin: req.get('origin'),
        referer: req.get('referer'),
      });
    }
    next();
  });

  // Clerk webhook handler for user events
  app.post('/api/webhooks/clerk', async (req, res) => {
    try {
      const { type, data } = req.body;
      
      console.log('[CLERK] Webhook received:', type);

      switch (type) {
        case 'user.created':
        case 'user.updated':
          await syncUserWithDatabase(data);
          break;
        
        case 'user.deleted':
          // Handle user deletion if needed
          console.log('[CLERK] User deleted:', data.id);
          break;
        
        default:
          console.log('[CLERK] Unhandled webhook type:', type);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('[CLERK] Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Login redirect endpoint
  app.get('/api/login', (req, res) => {
    // Redirect to Clerk's hosted sign-in page
    const signInUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign-in`;
    res.redirect(signInUrl);
  });

  // Callback endpoint (handled by Clerk automatically)
  app.get('/api/callback', (req, res) => {
    // Clerk handles the callback automatically
    // Redirect to appropriate page based on user status
    res.redirect('/dashboard');
  });

  // Admin login endpoint
  app.post('/api/admin-login', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ message: 'Unauthorized admin access' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: 'Admin user not found' });
      }

      // For admin access, we'll rely on Clerk's authentication
      res.json({ 
        message: 'Please use Clerk authentication for admin access',
        redirectTo: '/sign-in'
      });

    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Admin login failed' });
    }
  });

  // Logout endpoint
  app.post('/api/logout', (req, res) => {
    // Clear our session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      res.clearCookie('sessionId');
      res.json({ success: true, redirectTo: '/' });
    });
  });
}

// Authentication middleware using Clerk
export const requireAuth = ClerkExpressRequireAuth({
  onError: (error) => {
    console.error('[CLERK] Authentication error:', error);
  }
});

// Optional authentication middleware
export const withAuth = ClerkExpressWithAuth({
  onError: (error) => {
    console.error('[CLERK] Optional auth error:', error);
  }
});

// Custom middleware to sync authenticated user with database
export const syncUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.auth?.userId) {
      // User is authenticated with Clerk, sync with our database
      const clerkUser = await req.auth.user;
      if (clerkUser) {
        const dbUser = await syncUserWithDatabase(clerkUser);
        // Store database user in request for easy access
        (req as any).dbUser = dbUser;
      }
    }
    next();
  } catch (error) {
    console.error('[CLERK] User sync error:', error);
    next(); // Continue even if sync fails
  }
};

// Backward compatible middleware (replaces isAuthenticated)
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth?.userId) {
    console.log('Authentication failed: No Clerk user ID');
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  next();
};

// Admin check middleware
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const dbUser = (req as any).dbUser || await storage.getUser(req.auth.userId);
    if (!dbUser || !dbUser.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error('[CLERK] Admin check error:', error);
    res.status(500).json({ message: "Authorization check failed" });
  }
};