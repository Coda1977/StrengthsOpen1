import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Admin from '../pages/Admin';
import { vi } from 'vitest';
import * as useAuthModule from './useAuth';

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}));

const useAuth = useAuthModule.useAuth as unknown as ReturnType<typeof vi.fn>;

// Mock window.location to prevent navigation errors
const originalLocation = window.location;
beforeAll(() => {
  // @ts-ignore
  delete window.location;
  // @ts-ignore
  window.location = { href: '', assign: vi.fn() };
});
afterAll(() => {
  window.location = originalLocation;
});

describe('Admin Dashboard', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // it('should not render for non-admin users', async () => {
  //   // Return a new object each time to trigger re-render
  //   useAuth.mockImplementation(() => ({ user: { email: 'user@example.com' }, isAuthenticated: true, isLoading: false }));
  //   render(<Admin />);
  //   // Wait for the alert element to appear
  //   const alert = await screen.findByRole('alert');
  //   expect(alert.textContent?.toLowerCase()).toContain('access denied');
  // });

  it('should render for admin user', async () => {
    useAuth.mockImplementation(() => ({ user: { email: 'tinymanagerai@gmail.com' }, isAuthenticated: true, isLoading: false }));
    // Mock fetch for admin API endpoints
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url.includes('/api/admin/users')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
        }
        if (url.includes('/api/admin/emails')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
        }
        if (url.includes('/api/admin/health')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ database: 'healthy', openai: 'healthy', resend: 'healthy', timestamp: new Date().toISOString() }) } as Response);
        }
        if (url.includes('/api/admin/analytics')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: { total: 1, onboarded: 1, recent: 1 }, emails: { total: 1, sent: 1, failed: 0, recent: 1 }, deliveryRate: 100 }) } as Response);
        }
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    render(<Admin />);
    // Wait for the dashboard title
    expect(await screen.findByText('Admin Dashboard')).toBeInTheDocument();
    // Check for section titles using exact text
    expect(await screen.findByText('User Management')).toBeInTheDocument();
    expect(await screen.findByText('Email Logs')).toBeInTheDocument();
    expect(await screen.findByText('Email Testing')).toBeInTheDocument();
  });
}); 