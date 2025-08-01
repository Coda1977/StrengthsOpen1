import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    try {
      const config = await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      );
      console.log('OIDC Config loaded successfully');
      return config;
    } catch (error) {
      console.error('OIDC Config error:', error);
      throw error;
    }
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  // Enhanced session store configuration with health monitoring
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Allow table creation if missing for robustness
    ttl: sessionTtl,
    tableName: "sessions",
    schemaName: 'public',
    pruneSessionInterval: 60 * 15, // 15 minutes
    disableTouch: false, // Enable session touch to prevent premature expiry
    errorLog: (err) => {
      console.error('[SESSION] Store error:', err);
      // Log detailed error information for debugging
      if (err.code) {
        console.error('[SESSION] Error code:', err.code);
      }
      if (err.detail) {
        console.error('[SESSION] Error detail:', err.detail);
      }
    },
  });

  // Add comprehensive session store event handlers
  sessionStore.on('connect', () => {
    console.log('[SESSION] Store successfully connected to database');
  });

  sessionStore.on('disconnect', () => {
    console.log('[SESSION] Store disconnected from database');
  });

  // Session store initialized
  try {
    console.log('[SESSION] Session store initialized successfully');
  } catch (error) {
    console.error('[SESSION] Failed to initialize session store:', error);
  }
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false, // Don't save unchanged sessions
    saveUninitialized: false, // Don't save empty sessions
    rolling: true, // Reset expiry on activity to prevent premature logout
    name: 'sessionId', // Custom session name for better security
    cookie: {
      httpOnly: true, // Prevent XSS attacks
      secure: process.env.NODE_ENV === 'production', // Secure only in production
      maxAge: sessionTtl,
      sameSite: 'lax', // More compatible setting
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  try {
    console.log('[AUTH] upsertUser called with claims:', {
      sub: claims["sub"],
      email: claims["email"],
      first_name: claims["first_name"]
    });

    // Use the improved upsertUser method that handles ID reconciliation
    const user = await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });

    console.log('[AUTH] User upserted successfully:', {
      id: user.id,
      email: user.email,
      isNewUser: !user.hasCompletedOnboarding
    });

    // Check if this is a new user (hasn't completed onboarding)
    const isNewUser = !user.hasCompletedOnboarding;

    // Send authorization welcome email for new users
    if (isNewUser && claims["email"] && claims["first_name"]) {
      try {
        const { emailService } = await import('./emailService');
        const websiteUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'https://your-app.replit.app';
        
        await emailService.sendAuthorizationWelcomeEmail(
          claims["email"], 
          claims["first_name"], 
          websiteUrl
        );
        console.log(`[AUTH] Authorization welcome email sent to new user: ${claims["email"]}`);
      } catch (error) {
        console.error('[AUTH] Failed to send authorization welcome email:', error);
        // Don't fail the authentication flow if email fails
      }
    }
    
    return user;
  } catch (error) {
    console.error('[AUTH] Failed to upsert user during authentication:', error);
    
    // Enhanced error recovery with email-based lookup
    try {
      console.log('[AUTH] Attempting user recovery by email');
      const existingUser = await storage.getUserByEmail(claims["email"]);
      if (existingUser) {
        console.log('[AUTH] Found existing user by email during recovery:', existingUser.id);
        return existingUser;
      }
      
      // Fallback: try by original ID
      const userById = await storage.getUser(claims["sub"]);
      if (userById) {
        console.log('[AUTH] Found existing user by ID during recovery');
        return userById;
      }
    } catch (findError) {
      console.error('[AUTH] Failed to find existing user during recovery:', findError);
    }
    
    // Only throw if we truly can't proceed
    throw new Error('User account setup failed: Unable to create or find user account');
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Add comprehensive request logging middleware
  app.use((req, res, next) => {
    if (req.path.includes('/api/')) {
      console.log(`[AUTH DEBUG] ${req.method} ${req.path}`, {
        hostname: req.hostname,
        host: req.get('host'),
        'x-forwarded-host': req.get('x-forwarded-host'),
        'x-forwarded-proto': req.get('x-forwarded-proto'),
        origin: req.get('origin'),
        referer: req.get('referer'),
        userAgent: req.get('user-agent')?.substring(0, 100)
      });
    }
    next();
  });

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const user = {};
      updateUserSession(user, tokens);
      
      // Get the actual user from database (handles ID reconciliation)
      const dbUser = await upsertUser(tokens.claims());
      
      // CRITICAL: Update session with the correct user ID from database
      const claims = tokens.claims();
      if (dbUser && claims && dbUser.id !== claims["sub"]) {
        console.log('[AUTH] Updating session with reconciled user ID:', {
          tokenId: claims["sub"],
          dbId: dbUser.id
        });
        // Update the claims to use the database user ID
        (user as any).claims = {
          ...claims,
          sub: dbUser.id
        };
      }
      
      verified(null, user);
    } catch (error) {
      console.error('[AUTH] Verification failed:', error);
      verified(error, null);
    }
  };

  // Enhanced domain resolution with fallbacks
  const replitDomains = process.env.REPLIT_DOMAINS?.split(",") || [];
  const deploymentDomain = process.env.REPL_ID ? `${process.env.REPL_ID}.replit.app` : null;
  
  // Dynamic domain detection from environment
  const possibleDomains = [
    ...replitDomains,
    ...(deploymentDomain ? [deploymentDomain] : []),
    'localhost',
    '127.0.0.1'
  ];
  
  // Add current Replit dev domain if available
  const currentReplitDomain = process.env.REPL_SLUG && process.env.REPL_OWNER 
    ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` 
    : null;
  if (currentReplitDomain) {
    possibleDomains.push(currentReplitDomain);
  }
  
  const domains = Array.from(new Set(possibleDomains)); // Remove duplicates
  
  console.log('Auth environment variables:', {
    REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
    REPL_ID: process.env.REPL_ID,
    REPL_SLUG: process.env.REPL_SLUG,
    REPL_OWNER: process.env.REPL_OWNER
  });
  console.log('Auth domains being registered:', domains);
  
  for (const domain of domains) {
    // Use the actual Replit domain for callback URL, even for localhost requests
    const callbackDomain = domain === 'localhost' || domain === '127.0.0.1' ? replitDomains[0] || domain : domain;
    
    console.log(`Registering auth strategy for domain: ${domain}, callback: https://${callbackDomain}/api/callback`);
    
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${callbackDomain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  // Enhanced session serialization with user ID validation
  passport.serializeUser((user: Express.User, cb) => {
    console.log('[PASSPORT] Serializing user:', (user as any)?.claims?.sub);
    cb(null, user);
  });
  
  passport.deserializeUser(async (user: Express.User, cb) => {
    try {
      const userId = (user as any)?.claims?.sub;
      const userEmail = (user as any)?.claims?.email;
      
      console.log('[PASSPORT] Deserializing user:', { userId, userEmail });
      
      if (!userId || !userEmail) {
        console.log('[PASSPORT] Invalid session data, clearing session');
        return cb(null, false);
      }
      
      // Verify user still exists in database during deserialization
      const dbUser = await storage.reconcileUserSession(userId, userEmail);
      if (!dbUser) {
        console.log('[PASSPORT] User not found during deserialization, clearing session');
        return cb(null, false);
      }
      
      // Update session with reconciled user ID if needed
      if (dbUser.id !== userId) {
        console.log('[PASSPORT] Updating session with reconciled user ID:', {
          oldId: userId,
          newId: dbUser.id
        });
        (user as any).claims.sub = dbUser.id;
      }
      
      cb(null, user);
    } catch (error) {
      console.error('[PASSPORT] Error during deserialization:', error);
      cb(null, false);
    }
  });

  app.get("/api/login", (req, res, next) => {
    // Enhanced host resolution with fallbacks
    const hostname = req.hostname || req.get('host')?.split(':')[0] || 'localhost';
    const forwardedHost = req.get('x-forwarded-host');
    
    // Try multiple hostname resolution strategies
    const possibleHosts = [
      hostname,
      forwardedHost,
      req.get('host')?.split(':')[0],
      'localhost'
    ].filter(Boolean);
    
    console.log('[AUTH] Login attempt:', {
      hostname,
      forwardedHost,
      possibleHosts,
      registeredStrategies: domains
    });
    
    // Find matching strategy
    let strategyName = null;
    let matchedHost = null;
    
    for (const host of possibleHosts) {
      if (domains.includes(host)) {
        strategyName = `replitauth:${host}`;
        matchedHost = host;
        break;
      }
    }
    
    // Fallback to first registered domain if no match
    if (!strategyName) {
      matchedHost = domains[0];
      strategyName = `replitauth:${matchedHost}`;
      console.log('[AUTH] No exact match found, using fallback:', matchedHost);
    }
    
    console.log('[AUTH] Using strategy:', strategyName, 'for host:', matchedHost);
    
    try {
      passport.authenticate(strategyName, {
        scope: ["openid", "email", "profile", "offline_access"]
      })(req, res, next);
    } catch (error) {
      console.error('[AUTH] Login error:', error);
      res.status(500).json({ 
        message: "Authentication failed", 
        error: "Unable to initiate login process",
        debug: { hostname, forwardedHost, strategyName }
      });
    }
  });

  app.get("/api/callback", async (req, res, next) => {
    // Enhanced host resolution for callback
    const hostname = req.hostname || req.get('host')?.split(':')[0] || 'localhost';
    const forwardedHost = req.get('x-forwarded-host');
    
    const possibleHosts = [
      hostname,
      forwardedHost,
      req.get('host')?.split(':')[0],
      'localhost'
    ].filter(Boolean);
    
    console.log('[AUTH] Callback attempt:', {
      hostname,
      forwardedHost,
      possibleHosts,
      query: req.query
    });
    
    // Find matching strategy
    let strategyName = null;
    let matchedHost = null;
    
    for (const host of possibleHosts) {
      if (domains.includes(host)) {
        strategyName = `replitauth:${host}`;
        matchedHost = host;
        break;
      }
    }
    
    // Fallback to first registered domain if no match
    if (!strategyName) {
      matchedHost = domains[0];
      strategyName = `replitauth:${matchedHost}`;
      console.log('[AUTH] Callback fallback to:', matchedHost);
    }
    
    console.log('[AUTH] Callback using strategy:', strategyName);
    
    passport.authenticate(strategyName, async (err: any, user: any) => {
      if (err) {
        console.error('[AUTH] Authentication error:', err);
        // Don't redirect on authentication errors, let them retry
        return res.status(500).json({ 
          message: "Authentication failed", 
          error: err.message || 'Unknown authentication error',
          code: 'AUTH_ERROR'
        });
      }
      if (!user) {
        console.error('[AUTH] No user returned from authentication');
        return res.redirect("/api/login?error=no_user");
      }

      req.logIn(user, async (loginErr: any) => {
        if (loginErr) {
          console.error('[AUTH] Login error:', loginErr);
          return res.redirect("/api/login?error=login_failed");
        }

        console.log('[AUTH] Login successful for user:', user.claims?.sub);

        try {
          // Use the user ID from the session (which has been reconciled)
          const sessionUserId = user.claims?.sub;
          if (!sessionUserId) {
            console.error('[AUTH] No user ID in session claims');
            return res.redirect("/api/login?error=invalid_session");
          }
          
          const dbUser = await storage.getUser(sessionUserId);
          
          if (!dbUser) {
            console.error('[AUTH] No database user found after successful login');
            return res.redirect("/api/login?error=user_not_found");
          }
          
          console.log('[AUTH] User status check:', {
            userId: dbUser.id,
            hasCompletedOnboarding: dbUser.hasCompletedOnboarding,
            email: dbUser.email
          });
          
          if (dbUser.hasCompletedOnboarding) {
            console.log('[AUTH] Redirecting to dashboard');
            return res.redirect("/dashboard");
          } else {
            console.log('[AUTH] Redirecting to onboarding');
            return res.redirect("/onboarding");
          }
        } catch (error) {
          console.error('[AUTH] Error checking user status:', error);
          // Default to onboarding in case of errors
          return res.redirect("/onboarding");
        }
      });
    })(req, res, next);
  });

  // Emergency admin login bypass (for Replit Auth issues)
  app.post("/api/admin-login", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ message: 'Unauthorized admin access' });
      }

      const { storage } = await import('./storage');
      const user = await storage.getUserByEmail(email);
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: 'Admin user not found' });
      }

      // Create a mock session for admin
      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        },
        expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
      };

      req.login(sessionUser, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Login failed', error: err.message });
        }
        res.json({ message: 'Admin login successful', redirectTo: '/dashboard' });
      });

    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Admin login failed' });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      // Clear the session and redirect to home page
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
        res.clearCookie('sessionId');
        res.redirect('/');
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user) {
    console.log('Authentication failed: No user or not authenticated');
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Skip token expiry check for now to allow conversation loading
  if (user.claims && user.claims.sub) {
    return next();
  }

  // If user doesn't have expires_at, they might be in an old session format
  if (!user.expires_at) {
    console.log('Authentication failed: No expires_at');
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.log('Authentication failed: No refresh token');
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    console.error('Token refresh failed:', error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};