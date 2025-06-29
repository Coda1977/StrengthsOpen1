import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for serverless environment
neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = false;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isDev = process.env.NODE_ENV === 'development';

// Create pool with optimized settings for Neon serverless
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1, // Single connection for serverless to avoid conflicts
  idleTimeoutMillis: 30000, // 30 seconds idle timeout for Neon
  connectionTimeoutMillis: 20000, // Increased timeout
  maxUses: 7500, // Limit reuse to prevent stale connections
  allowExitOnIdle: true, // Allow pool to exit when idle
});

// Enhanced error handling with reconnection logic
pool.on('error', (err) => {
  if (isDev) console.error('Database pool error:', err);
  // Log specific error details for debugging
  if ((err as any).code === '57P01' && isDev) {
    console.log('Connection terminated by administrator - will reconnect automatically');
  }
});

pool.on('connect', (client) => {
  if (isDev) console.log('Database connected successfully');
});

pool.on('remove', (client) => {
  if (isDev) console.log('Database connection removed from pool');
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  if (isDev) console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (isDev) console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

export const db = drizzle({ client: pool, schema });