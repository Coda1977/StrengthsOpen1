import { Express } from 'express';
import request from 'supertest';
import { app } from '../index';
import jwt from 'jsonwebtoken';

export interface TestUser {
  id: string;
  username: string;
  topStrengths: string[];
}

export interface TestMessage {
  id: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: Date;
}

export interface TestConversation {
  id: string;
  title: string;
  messages: TestMessage[];
  lastActivity: Date;
  mode: 'personal' | 'team';
}

export const testRequest = () => request(app);

export const createTestToken = (userId: string = 'test-user') => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');
};

export const createAuthenticatedRequest = async () => {
  const agent = request.agent(app);
  const token = createTestToken();
  
  // Set auth cookie
  await agent
    .post('/api/auth/test-login')
    .send({ token })
    .expect(200);
  
  return agent;
};

export const mockUser: TestUser = {
  id: 'test-user',
  username: 'testuser',
  topStrengths: ['Achiever', 'Learner', 'Strategic']
};

export const mockConversation: TestConversation = {
  id: 'test-conversation',
  title: 'Test Conversation',
  messages: [
    {
      id: 'msg1',
      content: 'Test message',
      type: 'user',
      timestamp: new Date()
    },
    {
      id: 'msg2',
      content: 'Test response',
      type: 'ai',
      timestamp: new Date()
    }
  ],
  lastActivity: new Date(),
  mode: 'personal'
};

export const clearTestData = async () => {
  // Add cleanup logic here if needed
}; 