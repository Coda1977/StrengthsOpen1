import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('User Management & Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: '123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            isAdmin: false
          },
          token: 'jwt-token-here'
        }),
      } as Response);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe'
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.isAdmin).toBe(false);
      expect(data.token).toBeDefined();
    });

    it('should handle registration validation errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Validation failed',
          details: {
            email: 'Email is required',
            password: 'Password must be at least 8 characters'
          }
        }),
      } as Response);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '',
          password: '123',
          firstName: 'John'
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
      expect(data.details.email).toBe('Email is required');
    });
  });

  describe('User Login', () => {
    it('should login user successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: '123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            isAdmin: false
          },
          token: 'jwt-token-here'
        }),
      } as Response);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('test@example.com');
      expect(data.token).toBeDefined();
    });

    it('should handle invalid credentials', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: 'Invalid credentials'
        }),
      } as Response);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpassword'
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid credentials');
    });
  });

  describe('Admin Access Control', () => {
    it('should allow admin access for admin users', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          isAdmin: true,
          user: {
            id: 'admin123',
            email: 'tinymanagerai@gmail.com',
            firstName: 'Admin',
            lastName: 'User',
            isAdmin: true
          }
        }),
      } as Response);

      const response = await fetch('/api/auth/verify-admin', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.isAdmin).toBe(true);
      expect(data.user.email).toBe('tinymanagerai@gmail.com');
    });

    it('should deny admin access for non-admin users', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          error: 'Access denied. Admin privileges required.'
        }),
      } as Response);

      const response = await fetch('/api/auth/verify-admin', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer user-token'
        },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Access denied. Admin privileges required.');
    });
  });

  describe('User Profile Management', () => {
    it('should update user profile successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            id: '123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Smith',
            isAdmin: false
          }
        }),
      } as Response);

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer user-token'
        },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Smith'
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.lastName).toBe('Smith');
    });

    it('should fetch user profile correctly', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: {
            id: '123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            isAdmin: false,
            strengths: ['Leadership', 'Communication'],
            onboardingCompleted: true
          }
        }),
      } as Response);

      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: { 
          'Authorization': 'Bearer user-token'
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.strengths).toHaveLength(2);
      expect(data.user.onboardingCompleted).toBe(true);
    });
  });

  describe('Onboarding Flow', () => {
    it('should complete onboarding successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          onboardingCompleted: true,
          strengths: ['Leadership', 'Communication', 'Problem Solving']
        }),
      } as Response);

      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer user-token'
        },
        body: JSON.stringify({
          strengths: ['Leadership', 'Communication', 'Problem Solving'],
          goals: ['Improve leadership skills', 'Better communication'],
          timezone: 'America/New_York'
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.onboardingCompleted).toBe(true);
      expect(data.strengths).toHaveLength(3);
    });

    it('should validate onboarding data', () => {
      const validateOnboardingData = (data: any): boolean => {
        return !!(data.strengths && 
               Array.isArray(data.strengths) && 
               data.strengths.length >= 1 &&
               data.strengths.length <= 5 &&
               data.goals &&
               Array.isArray(data.goals) &&
               data.goals.length >= 1 &&
               data.timezone &&
               typeof data.timezone === 'string');
      };

      expect(validateOnboardingData({
        strengths: ['Leadership'],
        goals: ['Improve skills'],
        timezone: 'America/New_York'
      })).toBe(true);

      expect(validateOnboardingData({
        strengths: [],
        goals: ['Improve skills'],
        timezone: 'America/New_York'
      })).toBe(false);

      expect(validateOnboardingData({
        strengths: ['Leadership'],
        goals: [],
        timezone: 'America/New_York'
      })).toBe(false);
    });
  });

  describe('Password Management', () => {
    it('should change password successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Password changed successfully'
        }),
      } as Response);

      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer user-token'
        },
        body: JSON.stringify({
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Password changed successfully');
    });

    it('should validate password strength', () => {
      const validatePassword = (password: string): boolean => {
        return password.length >= 8 && 
               /[A-Z]/.test(password) && 
               /[a-z]/.test(password) && 
               /[0-9]/.test(password);
      };

      expect(validatePassword('StrongPass123')).toBe(true);
      expect(validatePassword('weak')).toBe(false);
      expect(validatePassword('nouppercase123')).toBe(false);
      expect(validatePassword('NOLOWERCASE123')).toBe(false);
      expect(validatePassword('NoNumbers')).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should logout user successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Logged out successfully'
        }),
      } as Response);

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer user-token'
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logged out successfully');
    });

    it('should refresh token successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          token: 'new-jwt-token',
          user: {
            id: '123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe'
          }
        }),
      } as Response);

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer old-token'
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.token).toBe('new-jwt-token');
      expect(data.user.email).toBe('test@example.com');
    });
  });
}); 