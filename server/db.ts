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

// Create pool with optimized settings for Neon serverless
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1, // Single connection for serverless to avoid conflicts
  idleTimeoutMillis: 0, // Disable idle timeout for serverless
  connectionTimeoutMillis: 20000, // Increased timeout
  maxUses: Infinity, // Allow unlimited reuse
  allowExitOnIdle: false,
});

// Enhanced error handling with reconnection logic
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Log specific error details for debugging
  if (err.code === '57P01') {
    console.log('Connection terminated by administrator - will reconnect automatically');
  }
});

pool.on('connect', (client) => {
  console.log('Database connected successfully');
});

pool.on('remove', (err) => {
  if (err) {
    console.log('Database connection removed due to error:', err.message);
  } else {
    console.log('Database connection removed from pool (normal)');
  }
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

export const db = drizzle({ client: pool, schema });