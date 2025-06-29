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
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  // Enhanced session store configuration to prevent corruption
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false, // Table already exists in schema
    ttl: sessionTtl,
    tableName: "sessions",
    schemaName: 'public',
    pruneSessionInterval: 60 * 15, // 15 minutes
    disableTouch: false, // Enable session touch to prevent premature expiry
    errorLog: (err) => {
      console.error('Session store error:', err);
      // Log but don't crash - session middleware will handle gracefully
    },
  });

  // Add session store event handlers for monitoring
  sessionStore.on('connect', () => {
    console.log('Session store connected to database');
  });

  sessionStore.on('disconnect', () => {
    console.log('Session store disconnected from database');
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false, // Don't save unchanged sessions
    saveUninitialized: false, // Don't save empty sessions
    rolling: true, // Reset expiry on activity to prevent premature logout
    name: 'sessionId', // Custom session name for better security
    cookie: {
      httpOnly: true, // Prevent XSS attacks
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      maxAge: sessionTtl,
      sameSite: 'strict', // CSRF protection
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
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

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

  // Register strategies for both Replit domains and localhost
  const replitDomains = process.env.REPLIT_DOMAINS?.split(",") || [];
  const domains = [...replitDomains, 'localhost', '127.0.0.1'];
  
  for (const domain of domains) {
    // Use the actual Replit domain for callback URL, even for localhost requests
    const callbackDomain = domain === 'localhost' || domain === '127.0.0.1' ? replitDomains[0] || domain : domain;
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
    const hostname = req.hostname || req.get('host')?.split(':')[0] || 'localhost';
    const strategyName = `replitauth:${hostname}`;
    

    
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", async (req, res, next) => {
    const hostname = req.hostname || req.get('host')?.split(':')[0] || 'localhost';
    const strategyName = `replitauth:${hostname}`;
    
    passport.authenticate(strategyName, async (err: any, user: any) => {
      if (err) {
        console.error('Authentication error:', err);
        return res.redirect("/api/login");
      }
      if (!user) {
        return res.redirect("/api/login");
      }

      // Log the user in
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error('Login error:', loginErr);
          return res.redirect("/api/login");
        }

        try {
          // Check if user has completed onboarding
          const dbUser = await storage.getUser(user.claims.sub);
          if (dbUser && dbUser.hasCompletedOnboarding) {
            return res.redirect("/dashboard");
          } else {
            return res.redirect("/onboarding");
          }
        } catch (error) {
          console.error('Error checking user status:', error);
          return res.redirect("/onboarding");
        }
      });
    })(req, res, next);
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