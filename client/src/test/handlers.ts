import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock auth endpoint
  http.get('/api/auth/user', () => {
    return HttpResponse.json({
      id: 'test-user-id',
      username: 'testuser',
      topStrengths: ['Achiever', 'Learner', 'Strategic']
    });
  }),

  // Mock chat messages endpoint
  http.post('/api/chat-with-coach', () => {
    return HttpResponse.json({
      data: {
        response: 'Test AI response',
        followUpQuestions: ['Question 1', 'Question 2', 'Question 3']
      }
    });
  }),

  // Mock follow-up questions endpoint
  http.post('/api/followup-questions', () => {
    return HttpResponse.json({
      data: {
        questions: ['Question 1', 'Question 2', 'Question 3']
      }
    });
  }),

  // Mock starter questions endpoint
  http.get('/api/starter-questions', () => {
    return HttpResponse.json({
      questions: ['Question 1', 'Question 2', 'Question 3']
    });
  }),

  // Mock conversations endpoint
  http.get('/api/conversations', () => {
    return HttpResponse.json({
      conversations: [
        {
          id: 'test-conversation',
          title: 'Test Conversation',
          mode: 'personal',
          lastActivity: new Date().toISOString()
        }
      ]
    });
  }),

  // Mock conversation backups endpoint
  http.get('/api/conversations/backups', () => {
    return HttpResponse.json({
      backups: []
    });
  }),

  // Mock context starter questions endpoint
  http.post('/api/context-starter-questions', () => {
    return HttpResponse.json({
      questions: ['Question 1', 'Question 2', 'Question 3']
    });
  }),

  // Add more handlers as needed

  http.post('/api/conversations', () => {
    return HttpResponse.json({
      id: 'new-conversation'
    });
  }),

  http.delete('/api/conversations/:id', () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.post('/api/auth/test-login', () => {
    return new HttpResponse(null, { status: 200 });
  })
]; 