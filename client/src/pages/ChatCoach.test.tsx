import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../test/setup';
import ChatCoach from './ChatCoach';
import userEvent from '@testing-library/user-event';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
      gcTime: 0,
    },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    ),
    queryClient,
  };
};

const starterQuestions = [
  'How can I better leverage my top strengths as a leader?',
  
  "What are some ways to develop my team's potential?",
  'How do I handle conflicts based on different strength combinations?'
];

describe('ChatCoach', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('renders starter questions and handles click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatCoach />);
    
    await waitFor(() => {
      starterQuestions.forEach(q => {
        expect(screen.getByText(q)).toBeInTheDocument();
      });
    });

    const starterQuestion = screen.getByText(starterQuestions[0]);
    await user.click(starterQuestion);
    const sendButton = screen.getByRole('button', { name: /send message/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Test AI response')).toBeInTheDocument();
    });
  });

  it('sends a message and displays AI response with follow-up questions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatCoach />);
    
    const input = screen.getByPlaceholderText(/ask about your strengths or team/i);
    const sendButton = screen.getByRole('button', { name: /send message/i });

    await user.type(input, 'Test message');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Test AI response')).toBeInTheDocument();
      expect(screen.getByText('Question 1')).toBeInTheDocument();
      expect(screen.getByText('Question 2')).toBeInTheDocument();
      expect(screen.getByText('Question 3')).toBeInTheDocument();
    });
  });

  it('handles errors gracefully', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/chat-with-coach', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    renderWithProviders(<ChatCoach />);
    
    const input = screen.getByPlaceholderText(/ask about your strengths or team/i);
    const sendButton = screen.getByRole('button', { name: /send message/i });

    await user.type(input, 'Test message');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('handles message input and Enter key press', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatCoach />);
    
    const input = screen.getByPlaceholderText(/ask about your strengths or team/i);

    await user.type(input, 'Test message{enter}');

    await waitFor(() => {
      expect(screen.getByText('Test AI response')).toBeInTheDocument();
    });
  });

  it('shows loading state while waiting for AI response', async () => {
    const user = userEvent.setup();
    let resolveResponse: (value: unknown) => void;
    
    server.use(
      http.post('/api/chat-with-coach', async () => {
        await new Promise(resolve => {
          resolveResponse = resolve;
        });
        return HttpResponse.json({
          data: {
            response: 'Test AI response',
            followUpQuestions: ['Question 1', 'Question 2', 'Question 3']
          }
        });
      })
    );

    renderWithProviders(<ChatCoach />);
    
    const input = screen.getByPlaceholderText(/ask about your strengths or team/i);
    const sendButton = screen.getByRole('button', { name: /send message/i });

    await user.type(input, 'Test message');
    await user.click(sendButton);

    expect(screen.getByText(/AI is thinking/i)).toBeInTheDocument();
    
    await resolveResponse!(undefined);

    await waitFor(() => {
      expect(screen.getByText('Test AI response')).toBeInTheDocument();
      expect(screen.queryByText(/AI is thinking/i)).not.toBeInTheDocument();
    });
  });
}); 