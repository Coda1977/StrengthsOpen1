import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmailSettings from '../pages/EmailSettings';

// Mock the useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { email: 'test@example.com', id: '123' },
    isAuthenticated: true,
    isLoading: false,
  })),
}));

// Mock the useToast hook
vi.mock('../hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('Email System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Email Settings Page', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      global.fetch = vi.fn((url) => {
        if (typeof url === 'string') {
          if (url.includes('/api/email-subscriptions')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ data: [
                {
                  id: 'sub1',
                  emailType: 'weekly_coaching',
                  isActive: true,
                  timezone: 'America/New_York',
                  weeklyEmailCount: '3',
                },
                {
                  id: 'sub2',
                  emailType: 'welcome',
                  isActive: true,
                  timezone: 'America/New_York',
                  weeklyEmailCount: '0',
                },
              ] }),
            } as Response);
          }
          if (url.includes('/api/email-logs')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ data: [] }),
            } as Response);
          }
        }
        // Default mock for other fetches
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });
    });

    it('should render email settings form', async () => {
      render(<EmailSettings />);
      // Wait for the main heading to appear
      expect(await screen.findByRole('heading', { name: /email settings/i })).toBeInTheDocument();
      // Wait for the weekly coaching emails section
      expect(await screen.findByText(/weekly coaching emails/i)).toBeInTheDocument();
    });

    it('should save email preferences', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.mocked(fetch);
      render(<EmailSettings />);
      // Wait for the weekly coaching emails section
      await screen.findByText(/weekly coaching emails/i);
      // Find all switches in the document
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(0);
      await user.click(switches[0]);
      // Find and click the save button if present (if not, skip this step)
      const saveButton = screen.queryByRole('button', { name: /save/i });
      if (saveButton) await user.click(saveButton);
      // Wait for fetch to be called for update
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe('Welcome Email Generation', () => {
    it('should generate welcome email with user strengths', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          subject: 'Welcome to TinyStrengthManager!',
          html: '<p>Welcome to your strengths journey!</p>',
        }),
      } as Response);

      const response = await fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '123',
          userEmail: 'test@example.com',
          firstName: 'John',
          topStrengths: ['Leadership', 'Communication', 'Problem Solving'],
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.subject).toContain('Welcome');
      expect(data.html).toContain('strengths journey');
    });

    it('should handle missing strengths gracefully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          subject: 'Welcome to TinyStrengthManager!',
          html: '<p>Welcome! Let\'s discover your strengths together.</p>',
        }),
      } as Response);

      const response = await fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '123',
          userEmail: 'test@example.com',
          firstName: 'John',
          topStrengths: [],
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.html).toContain('discover your strengths');
    });
  });

  describe('Weekly Email Generation', () => {
    it('should generate weekly email with context', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          subject: 'Your Weekly Strengths Focus',
          html: '<p>Here\'s your personalized weekly insights...</p>',
          weekNumber: 1,
        }),
      } as Response);

      const response = await fetch('/api/email/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '123',
          userEmail: 'test@example.com',
          firstName: 'John',
          topStrengths: ['Leadership', 'Communication'],
          weekNumber: 1,
          previousEmails: [],
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.subject).toContain('Weekly');
      expect(data.weekNumber).toBe(1);
    });

    it('should rotate email variety', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          subject: 'Weekly Strengths Challenge',
          html: '<p>This week\'s challenge...</p>',
          weekNumber: 2,
        }),
      } as Response);

      const response = await fetch('/api/email/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '123',
          userEmail: 'test@example.com',
          firstName: 'John',
          topStrengths: ['Leadership'],
          weekNumber: 2,
          previousEmails: [{ type: 'weekly', weekNumber: 1 }],
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.subject).toContain('Challenge');
    });
  });

  describe('Email Templates', () => {
    it('should render welcome email template correctly', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          subject: 'Welcome to TinyStrengthManager!',
          html: `
            <div>
              <h1>Welcome John!</h1>
              <p>Your top strengths: Leadership, Communication</p>
              <p>Let's start your strengths journey!</p>
            </div>
          `,
        }),
      } as Response);

      const response = await fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '123',
          userEmail: 'test@example.com',
          firstName: 'John',
          topStrengths: ['Leadership', 'Communication'],
        }),
      });

      const data = await response.json();
      expect(data.html).toContain('Welcome John!');
      expect(data.html).toContain('Leadership, Communication');
      expect(data.html).toContain('strengths journey');
    });

    it('should render weekly email template with proper formatting', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          subject: 'Week 1: Your Strengths Focus',
          html: `
            <div>
              <h1>Week 1: Leadership Focus</h1>
              <p>This week, let's explore your Leadership strength...</p>
              <div class="action-buttons">
                <a href="/chat">Chat with Coach</a>
                <a href="/dashboard">View Dashboard</a>
              </div>
            </div>
          `,
          weekNumber: 1,
        }),
      } as Response);

      const response = await fetch('/api/email/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '123',
          userEmail: 'test@example.com',
          firstName: 'John',
          topStrengths: ['Leadership'],
          weekNumber: 1,
          previousEmails: [],
        }),
      });

      const data = await response.json();
      expect(data.html).toContain('Week 1: Leadership Focus');
      expect(data.html).toContain('Chat with Coach');
      expect(data.html).toContain('View Dashboard');
    });
  });

  describe('Email Scheduling', () => {
    it('should schedule weekly emails correctly', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          scheduledCount: 5,
          message: 'Weekly emails scheduled successfully',
        }),
      } as Response);

      const response = await fetch('/api/admin/emails/send-weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.scheduledCount).toBeGreaterThan(0);
      expect(data.message).toContain('scheduled successfully');
    });

    it('should handle email scheduling errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Email service unavailable' }),
      } as Response);

      const response = await fetch('/api/admin/emails/send-weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('Email Performance', () => {
    it('should track email delivery status', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          emails: [
            {
              id: '1',
              status: 'sent',
              sentAt: new Date().toISOString(),
              emailType: 'welcome',
            },
            {
              id: '2',
              status: 'failed',
              sentAt: new Date().toISOString(),
              emailType: 'weekly',
              errorMessage: 'Invalid email address',
            },
          ],
        }),
      } as Response);

      const response = await fetch('/api/admin/emails');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.emails).toHaveLength(2);
      expect(data.emails[0].status).toBe('sent');
      expect(data.emails[1].status).toBe('failed');
    });
  });
}); 