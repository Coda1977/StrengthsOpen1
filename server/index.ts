import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./errorHandler";

export const app = express();

// Trust proxy for Replit domains
app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

const isDev = process.env.NODE_ENV === 'development';

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const server = await registerRoutes(app);

      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err instanceof Error ? err.message : String(err);

        // Enhanced error logging with context
        if (isDev) console.error('Server error:', {
          message: message,
          stack: err.stack,
          code: err.code,
          url: _req.url,
          method: _req.method,
          timestamp: new Date().toISOString()
        });

        // Don't expose internal errors in production
        const responseMessage = process.env.NODE_ENV === 'production' && status === 500 
          ? "Internal Server Error" 
          : message;

        res.status(status).json({ message: responseMessage });
      });

      // Setup system monitoring endpoints
      app.get('/api/system/health', async (req, res) => {
        const { resourceManager } = await import('./resourceManager');
        const resourceStats = resourceManager.getResourceStats();
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          resources: resourceStats,
          uptime: process.uptime()
        });
      });

      // importantly only setup vite in development and after
      // setting up all the other routes so the catch-all route
      // doesn't interfere with the other routes
      if (app.get("env") === "development") {
        await setupVite(app, server);
      } else {
        serveStatic(app);
      }

      // ALWAYS serve the app on port 5000
      // this serves both the API and the client.
      // It is the only port that is not firewalled.
      const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
      server.listen({
        port,
        host: "0.0.0.0",
      }, () => {
        log(`serving on port ${port}`);
        console.log(`Server accessible at:`);
        console.log(`- Local: http://localhost:${port}`);
        console.log(`- Network: http://0.0.0.0:${port}`);
      });

      // Graceful shutdown logic
      const shutdown = async (signal: string) => {
        try {
          log(`Received ${signal}, shutting down gracefully...`);
          // Stop accepting new connections
          await new Promise<void>((resolve, reject) => {
            server.close((err?: Error) => {
              if (err) return reject(err);
              resolve();
            });
          });
          // Stop cache cleanup
          try {
            const { storage } = await import('./storage');
            storage.stopCacheCleanup();
          } catch (e) { /* ignore */ }
          // Close DB pool if available
          try {
            const { db } = await import('./db');
            if (db && db.$client && typeof db.$client.end === 'function') await db.$client.end();
          } catch (e) { /* ignore */ }
          log('Server closed');
          process.exit(0);
        } catch (err) {
          console.error('Error during graceful shutdown:', err);
          process.exit(1);
        }
      };
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
      console.error('Failed to start server:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  })();
}
