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

// Create pool with better error handling and connection settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 2, // Reduce for Replit environment
  idleTimeoutMillis: 15000, // 15 second idle timeout
  connectionTimeoutMillis: 10000, // 10 second timeout
  maxUses: 7500, // Limit reuse
  allowExitOnIdle: false,
});

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't exit process on pool errors
});

pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('remove', () => {
  console.log('Database connection removed from pool');
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