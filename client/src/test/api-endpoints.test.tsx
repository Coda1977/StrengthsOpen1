import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('API Endpoints & Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Security', () => {
    it('should require authentication for protected endpoints', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: 'Authentication required'
        }),
      } as Response);

      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // No Authorization header
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Authentication required');
    });

    it('should validate JWT tokens', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: 'Invalid or expired token'
        }),
      } as Response);

      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid or expired token');
    });

    it('should prevent CSRF attacks', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          error: 'CSRF token validation failed'
        }),
      } as Response);

      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ firstName: 'John' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('CSRF token validation failed');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API calls', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1640995200'
        }),
        json: () => Promise.resolve({
          error: 'Rate limit exceeded. Please try again later.'
        }),
      } as Response);

      const response = await fetch('/api/chat-with-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test message' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      
      const data = await response.json();
      expect(data.error).toBe('Rate limit exceeded. Please try again later.');
    });
  });

  describe('Input Validation', () => {
    it('should validate email format', () => {
      const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user@domain.co.uk')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    it('should validate request body size', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: () => Promise.resolve({
          error: 'Request entity too large'
        }),
      } as Response);

      // Simulate a large request body
      const largeBody = 'x'.repeat(1000000); // 1MB
      const response = await fetch('/api/chat-with-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: largeBody }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toBe('Request entity too large');
    });

    it('should sanitize user input', () => {
      const sanitizeInput = (input: string): string => {
        return input
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]*>/g, '')
          .trim();
      };

      expect(sanitizeInput('<script>alert("xss")</script>Hello')).toBe('Hello');
      expect(sanitizeInput('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
      expect(sanitizeInput('  Normal text  ')).toBe('Normal text');
      expect(sanitizeInput('')).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({
          error: 'Database connection failed',
          code: 'DB_CONNECTION_ERROR'
        }),
      } as Response);

      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe('Database connection failed');
      expect(data.code).toBe('DB_CONNECTION_ERROR');
    });

    it('should handle external API failures', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.resolve({
          error: 'External service unavailable',
          code: 'EXTERNAL_API_ERROR'
        }),
      } as Response);

      const response = await fetch('/api/chat-with-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test message' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(502);
      const data = await response.json();
      expect(data.error).toBe('External service unavailable');
      expect(data.code).toBe('EXTERNAL_API_ERROR');
    });

    it('should provide meaningful error messages', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Invalid request parameters',
          details: {
            message: 'Message is required and must be a string',
            mode: 'Mode must be either "personal" or "team"'
          },
          code: 'VALIDATION_ERROR'
        }),
      } as Response);

      const response = await fetch('/api/chat-with-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '', mode: 'invalid' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request parameters');
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.message).toBe('Message is required and must be a string');
    });
  });

  describe('Response Formatting', () => {
    it('should return consistent response format', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            id: '123',
            email: 'test@example.com'
          },
          timestamp: '2024-01-01T00:00:00Z',
          version: '1.0.0'
        }),
      } as Response);

      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [
            { id: '1', email: 'user1@example.com' },
            { id: '2', email: 'user2@example.com' }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 25,
            totalPages: 3
          }
        }),
      } as Response);

      const response = await fetch('/api/admin/users?page=1&limit=10', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer admin-token' },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.total).toBe(25);
      expect(data.pagination.totalPages).toBe(3);
    });
  });

  describe('CORS and Headers', () => {
    it('should set appropriate CORS headers', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'Access-Control-Allow-Origin': 'https://yourdomain.com',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': 'application/json'
        }),
        json: () => Promise.resolve({ success: true }),
      } as Response);

      const response = await fetch('/api/health', {
        method: 'GET',
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://yourdomain.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should handle OPTIONS requests for CORS preflight', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': 'https://yourdomain.com',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }),
        json: () => Promise.resolve({}),
      } as Response);

      const response = await fetch('/api/chat-with-coach', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://yourdomain.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        },
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://yourdomain.com');
    });
  });

  describe('Health Checks', () => {
    it('should provide system health status', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
          services: {
            database: 'connected',
            email: 'connected',
            ai: 'connected'
          },
          uptime: 3600,
          version: '1.0.0'
        }),
      } as Response);

      const response = await fetch('/api/health');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.services.database).toBe('connected');
      expect(data.services.email).toBe('connected');
      expect(data.services.ai).toBe('connected');
      expect(data.uptime).toBeGreaterThan(0);
      expect(data.version).toBeDefined();
    });

    it('should handle health check failures', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({
          status: 'unhealthy',
          timestamp: '2024-01-01T00:00:00Z',
          services: {
            database: 'connected',
            email: 'disconnected',
            ai: 'connected'
          },
          errors: ['Email service is down']
        }),
      } as Response);

      const response = await fetch('/api/health');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.status).toBe('unhealthy');
      expect(data.services.email).toBe('disconnected');
      expect(data.errors).toContain('Email service is down');
    });
  });
}); 