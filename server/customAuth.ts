import { Request, Response, NextFunction, Express } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { storage } from './storage';
import crypto from 'crypto';

// Extend Express Request to include auth
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
        isAdmin?: boolean;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'fallback-secret-key';
const TOKEN_EXPIRY = '7d'; // 7 days

interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
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
    },
  });

  sessionStore.on('connect', () => {
    console.log('[SESSION] Store successfully connected to database');
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

// Generate JWT token
function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// Verify JWT token
function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      isAdmin: decoded.isAdmin,
    };
  } catch (error) {
    return null;
  }
}

// Hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate secure random password for admin user
function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('hex');
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
        authorization: req.get('authorization') ? 'present' : 'missing'
      });
    }
    next();
  });

  // Register endpoint
  app.post('/api/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password || !firstName) {
        return res.status(400).json({ message: 'Email, password, and first name are required' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const user = await storage.upsertUser({
        id: userId,
        email,
        firstName,
        lastName: lastName || '',
        passwordHash: hashedPassword,
      });

      // Send welcome email
      if (user) {
        try {
          const { emailService } = await import('./emailService');
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';
          
          await emailService.sendAuthorizationWelcomeEmail(email, firstName, appUrl);
          console.log(`[AUTH] Welcome email sent to new user: ${email}`);
        } catch (error) {
          console.error('[AUTH] Failed to send welcome email:', error);
        }
      }

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      });

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          isAdmin: user.isAdmin,
        },
        token,
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  // Login endpoint
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Get user
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      });

      // Store user in session
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      };

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          isAdmin: user.isAdmin,
        },
        token,
        redirectTo: user.hasCompletedOnboarding ? '/dashboard' : '/onboarding',
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Admin login endpoint (backward compatibility)
  app.post('/api/admin-login', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ message: 'Unauthorized admin access' });
      }

      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Create admin user if doesn't exist
        const adminPassword = generateSecurePassword();
        const hashedPassword = await hashPassword(adminPassword);
        
        console.log(`[ADMIN] Creating admin user with password: ${adminPassword}`);
        
        const adminId = 'admin-' + Date.now();
        user = await storage.upsertUser({
          id: adminId,
          email: email,
          firstName: 'Admin',
          lastName: 'User',
          passwordHash: hashedPassword,
        });
        
        // Complete onboarding
        await storage.updateUserOnboarding(adminId, {
          hasCompletedOnboarding: true,
          topStrengths: ['Strategic', 'Achiever', 'Developer', 'Analytical', 'Focus']
        });
        
        user = await storage.getUser(adminId);
      }

      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: 'Admin user not found' });
      }

      // Generate token for admin
      const token = generateToken({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      });

      res.json({ 
        success: true,
        message: 'Admin access granted',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          isAdmin: user.isAdmin,
        },
        token,
        redirectTo: '/dashboard'
      });

    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Admin login failed' });
    }
  });

  // Logout endpoint
  app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      res.clearCookie('sessionId');
      res.json({ success: true, redirectTo: '/' });
    });
  });

  // Get current user endpoint
  app.get('/api/me', isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Get fresh user data from database
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        isAdmin: user.isAdmin,
      });

    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Failed to get user' });
    }
  });
}

// Authentication middleware
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Check session first
  if ((req.session as any)?.user) {
    req.user = (req.session as any).user;
    return next();
  }

  // Check JWT token
  const authHeader = req.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    console.log('Authentication failed: No token provided');
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = verifyToken(token);
  if (!user) {
    console.log('Authentication failed: Invalid token');
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = user;
  next();
};

// Admin check middleware
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin && req.user?.email !== 'tinymanagerai@gmail.com') {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};