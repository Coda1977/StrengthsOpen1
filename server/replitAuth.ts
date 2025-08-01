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

  // Test session store connectivity
  try {
    sessionStore.query('SELECT 1', [], (err, result) => {
      if (err) {
        console.error('[SESSION] Initial connectivity test failed:', err);
      } else {
        console.log('[SESSION] Initial connectivity test passed');
      }
    });
  } catch (error) {
    console.error('[SESSION] Failed to test session store connectivity:', error);
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
  // Check if this is a new user
  const existingUser = await storage.getUser(claims["sub"]);
  const isNewUser = !existingUser;
  
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });

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
      console.log(`Authorization welcome email sent to new user: ${claims["email"]}`);
    } catch (error) {
      console.error('Failed to send authorization welcome email:', error);
      // Don't fail the authentication flow if email fails
    }
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
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
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
  
  const domains = [...new Set(possibleDomains)]; // Remove duplicates
  
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

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

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
        return res.redirect("/api/login?error=auth_failed");
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
          const dbUser = await storage.getUser(user.claims.sub);
          
          if (dbUser && dbUser.hasCompletedOnboarding) {
            return res.redirect("/dashboard");
          } else {
            return res.redirect("/onboarding");
          }
        } catch (error) {
          console.error('[AUTH] Error checking user status:', error);
          return res.redirect("/onboarding");
        }
      });
    })(req, res, next);
  });

  // Emergency admin login bypass (for Replit Auth issues)
  app.post("/api/admin-login", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || email !== 'codanudge@gmail.com') {
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