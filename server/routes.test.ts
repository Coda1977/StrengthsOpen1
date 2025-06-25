import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAuthenticatedRequest, mockUser, mockConversation, clearTestData } from './test/test-utils';
import { openai } from './openai';
import { db } from './db';
import { vi } from 'vitest';

describe('Chat Routes', () => {
  let authenticatedRequest: any;

  beforeEach(async () => {
    authenticatedRequest = await createAuthenticatedRequest();
  });

  afterEach(async () => {
    await clearTestData();
  });

  describe('POST /api/chat-with-coach', () => {
    it('should return AI response and follow-up questions', async () => {
      const response = await authenticatedRequest
        .post('/api/chat-with-coach')
        .send({
          message: 'Test message',
          mode: 'personal',
          conversationHistory: []
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('response');
      expect(response.body.data).toHaveProperty('followUpQuestions');
      expect(openai.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Mock OpenAI error
      vi.mocked(openai.chat.completions.create).mockRejectedValueOnce(
        new Error('API Error')
      );

      const response = await authenticatedRequest
        .post('/api/chat-with-coach')
        .send({
          message: 'Test message',
          mode: 'personal',
          conversationHistory: []
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/starter-questions', () => {
    it('should return starter questions', async () => {
      const response = await authenticatedRequest
        .get('/api/starter-questions');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('questions');
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/followup-questions', () => {
    it('should return follow-up questions based on AI response', async () => {
      const response = await authenticatedRequest
        .post('/api/followup-questions')
        .send({
          aiAnswer: 'Test AI response',
          conversationHistory: [
            { role: 'user', content: 'Test message' },
            { role: 'assistant', content: 'Test response' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('questions');
      expect(Array.isArray(response.body.data.questions)).toBe(true);
    });
  });

  describe('GET /api/conversations', () => {
    it('should return user conversations', async () => {
      // Mock database response
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockConversation]
      });

      const response = await authenticatedRequest
        .get('/api/conversations');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('conversations');
      expect(Array.isArray(response.body.conversations)).toBe(true);
      expect(response.body.conversations[0]).toMatchObject({
        id: mockConversation.id,
        title: mockConversation.title
      });
    });
  });

  describe('POST /api/context-starter-questions', () => {
    it('should return context-aware starter questions', async () => {
      const response = await authenticatedRequest
        .post('/api/context-starter-questions')
        .send({
          mode: 'personal',
          topStrengths: mockUser.topStrengths
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('questions');
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/conversations', () => {
    it('should create a new conversation', async () => {
      // Mock database response
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: 'new-conversation' }]
      });

      const response = await authenticatedRequest
        .post('/api/conversations')
        .send({
          title: 'New Conversation',
          mode: 'personal',
          messages: []
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe('new-conversation');
    });
  });

  describe('DELETE /api/conversations/:id', () => {
    it('should delete a conversation', async () => {
      // Mock database response
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1
      });

      const response = await authenticatedRequest
        .delete('/api/conversations/test-conversation');

      expect(response.status).toBe(200);
    });

    it('should handle non-existent conversation', async () => {
      // Mock database response for non-existent conversation
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 0
      });

      const response = await authenticatedRequest
        .delete('/api/conversations/non-existent');

      expect(response.status).toBe(404);
    });
  });
}); 