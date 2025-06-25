import { vi, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REPLIT_DOMAINS = 'test.repl.co';
process.env.REPLIT_DB_URL = 'http://localhost:8080';

// Mock OpenAI client
vi.mock('../openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Test AI response'
            }
          }]
        })
      }
    }
  }
}));

// Mock database
vi.mock('../db', () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn()
  }
}));

// Mock Replit auth
vi.mock('../replitAuth', () => ({
  validateAuth: vi.fn().mockResolvedValue({ userId: 'test-user' }),
  getUser: vi.fn().mockResolvedValue({ id: 'test-user', username: 'testuser' })
}));

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
}); 