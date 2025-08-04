import express from "express";
import { registerRoutes } from "../server/routes";

const app = express();

// Trust proxy for Vercel
app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Environment variable verification for Vercel
const verifyEnvironmentVariables = () => {
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);
  const warnings = [];

  if (missing.length > 0) {
    console.error('[ENV] Missing required environment variables:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT secret
  const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!jwtSecret) {
    warnings.push('JWT_SECRET not set, using SESSION_SECRET as fallback');
  }

  // Check app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';
  console.log('[ENV] APP_URL:', appUrl);

  if (warnings.length > 0) {
    console.warn('[ENV] Configuration warnings:', warnings);
  }

  console.log('[ENV] Environment verification completed successfully');
};

// Initialize server once
let initialized = false;

async function initializeServer() {
  if (initialized) return app;
  
  try {
    verifyEnvironmentVariables();
    await registerRoutes(app);
    initialized = true;
    console.log('[API] Serverless function initialized');
  } catch (error) {
    console.error('[API] Failed to initialize:', error);
    throw error;
  }
  
  return app;
}

// Export for Vercel serverless functions
export default async function handler(req: any, res: any) {
  try {
    const server = await initializeServer();
    return server(req, res);
  } catch (error) {
    console.error('[API] Handler error:', error);
    res.status(500).json({ 
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}