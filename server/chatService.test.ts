import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ChatService } from './chatService';
import { openai } from './openai';
import { db } from './db';

jest.mock('./openai');
jest.mock('./db');

describe('ChatService', () => {
  let chatService: ChatService;

  beforeEach(() => {
    chatService = new ChatService();
    jest.clearAllMocks();
  });

  describe('generateResponse', () => {
    it('should generate AI response with follow-up questions', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Test AI response'
          }
        }]
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await chatService.generateResponse({
        message: 'Test message',
        mode: 'personal',
        conversationHistory: []
      });

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('followUpQuestions');
      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Test message')
            })
          ])
        })
      );
    });

    it('should handle errors during response generation', async () => {
      (openai.chat.completions.create as jest.Mock).mockRejectedValueOnce(
        new Error('API Error')
      );

      await expect(chatService.generateResponse({
        message: 'Test message',
        mode: 'personal',
        conversationHistory: []
      })).rejects.toThrow('API Error');
    });
  });

  describe('generateFollowUpQuestions', () => {
    it('should generate follow-up questions based on AI response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Question 1\nQuestion 2\nQuestion 3'
          }
        }]
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await chatService.generateFollowUpQuestions({
        aiAnswer: 'Test AI response',
        conversationHistory: [
          { role: 'user', content: 'Test message' },
          { role: 'assistant', content: 'Test response' }
        ]
      });

      expect(result).toHaveProperty('questions');
      expect(Array.isArray(result.questions)).toBe(true);
      expect(result.questions.length).toBe(3);
    });
  });

  describe('generateStarterQuestions', () => {
    it('should generate starter questions', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Question 1\nQuestion 2\nQuestion 3'
          }
        }]
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await chatService.generateStarterQuestions();

      expect(result).toHaveProperty('questions');
      expect(Array.isArray(result.questions)).toBe(true);
      expect(result.questions.length).toBe(3);
    });
  });

  describe('generateContextStarterQuestions', () => {
    it('should generate context-aware starter questions', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Question 1\nQuestion 2\nQuestion 3'
          }
        }]
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await chatService.generateContextStarterQuestions({
        mode: 'personal',
        topStrengths: ['Achiever', 'Learner', 'Strategic']
      });

      expect(result).toHaveProperty('questions');
      expect(Array.isArray(result.questions)).toBe(true);
      expect(result.questions.length).toBe(3);
      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Achiever')
            })
          ])
        })
      );
    });
  });

  describe('saveConversation', () => {
    it('should save a new conversation', async () => {
      const mockConversation = {
        title: 'Test Conversation',
        mode: 'personal',
        messages: []
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'new-conversation' }]
      });

      const result = await chatService.saveConversation(mockConversation);

      expect(result).toHaveProperty('id', 'new-conversation');
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          mockConversation.title,
          mockConversation.mode,
          expect.any(Array)
        ])
      );
    });
  });

  describe('getConversations', () => {
    it('should return user conversations', async () => {
      const mockConversations = [{
        id: 'test-conversation',
        title: 'Test Conversation',
        mode: 'personal',
        lastActivity: new Date()
      }];

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: mockConversations
      });

      const result = await chatService.getConversations('test-user');

      expect(result).toHaveProperty('conversations');
      expect(Array.isArray(result.conversations)).toBe(true);
      expect(result.conversations[0]).toMatchObject(mockConversations[0]);
    });
  });
}); 