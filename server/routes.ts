import { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server } from 'http';
import multer from 'multer';
import { isAuthenticated, setupAuth } from './replitAuth';
import { storage } from './storage';
import { parseTeamMembersFile } from './fileParser';
import { generateTeamInsight, generateCollaborationInsight, generateCoachResponse, generateContextAwareStarterQuestions, generateFollowUpQuestions } from './openai';
import { errors, createSuccessResponse, createErrorResponse, AppError, ERROR_CODES } from './errorHandler';
import { emailScheduler } from './emailScheduler';
import { 
  insertTeamMemberSchema, 
  updateTeamMemberSchema, 
  updateUserOnboardingSchema,
  insertConversationSchema,
  insertMessageSchema,
  updateConversationSchema,
  insertConversationBackupSchema
} from '../shared/schema';
import { OpenAI } from 'openai';
import { Resend } from 'resend';
import { sql, desc, eq, gte } from 'drizzle-orm';
import { db } from './db';
import { users, emailLogs } from '../shared/schema';
import { EmailService } from './emailService';

interface AuthenticatedRequest extends Request {
  user: {
    claims: {
      sub: string;
      email: string;
      first_name: string;
      last_name: string;
    };
  };
}

// Enhanced authentication middleware with better error handling
const authenticatedMiddleware = (req: Request, res: Response, next: NextFunction) => {
  isAuthenticated(req, res, (err?: any) => {
    if (err) {
      console.error('Authentication middleware error:', err);
      return res.status(401).json({ 
        message: "Unauthorized",
        code: "AUTH_REQUIRED",
        redirect: "/auth/login"
      });
    }
    next();
  });
};

// Middleware to check if user has completed onboarding
const requireOnboarding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.claims.sub;
    const user = await storage.getUser(userId);
    
    if (!user || !user.hasCompletedOnboarding) {
      return res.status(403).json({
        message: "Onboarding required",
        code: "ONBOARDING_REQUIRED",
        redirect: "/onboarding"
      });
    }
    
    next();
  } catch (error) {
    console.error('Onboarding check error:', error);
    res.status(500).json({ message: "Failed to verify onboarding status" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Initialize email scheduler
  emailScheduler.init();

  // Enhanced file upload middleware with security measures
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { 
      fileSize: 5 * 1024 * 1024, // Reduced to 5MB for security
      files: 1, // Only allow single file upload
      fields: 10, // Limit form fields
    },
    fileFilter: (req, file, cb) => {
      // Strict file type validation
      const allowedMimeTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg'
      ];
      
      // Check MIME type
      if (!allowedMimeTypes.includes(file.mimetype)) {
        // Log or handle error as needed
        return cb(null, false);
      }
      
      // Validate file extension matches MIME type
      const fileExtension = file.originalname.toLowerCase().split('.').pop();
      const mimeToExtension: Record<string, string[]> = {
        'text/csv': ['csv'],
        'application/vnd.ms-excel': ['xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
        'image/png': ['png'],
        'image/jpeg': ['jpg', 'jpeg']
      };
      
      const allowedExtensions = mimeToExtension[file.mimetype as keyof typeof mimeToExtension] || [];
      if (!allowedExtensions.includes(fileExtension ?? '')) {
        // Log or handle error as needed
        return cb(null, false);
      }
      
      // Validate filename for security
      if (!/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
        // Log or handle error as needed
        return cb(null, false);
      }
      
      cb(null, true);
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Onboarding route
  app.post('/api/onboarding', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      const userClaims = (req as AuthenticatedRequest).user.claims;
      console.log('Onboarding request:', { userId, body: req.body });
      
      // Validate the request body
      const validatedData = updateUserOnboardingSchema.parse(req.body);
      console.log('Validated data:', validatedData);
      
      const user = await storage.updateUserOnboarding(userId, validatedData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Send welcome email after successful onboarding
      try {
        const timezone = req.body.timezone || 'America/New_York';
        await emailScheduler.sendWelcomeEmail(
          userId,
          userClaims.email,
          userClaims.first_name,
          timezone
        );
        console.log('Welcome email sent to:', userClaims.email);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the onboarding if email fails
      }
      
      console.log('Updated user:', user);
      res.json(user);
    } catch (error) {
      console.error("Error updating onboarding:", error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to update onboarding", error: msg });
    }
  });

  // Team member routes - require authentication and completed onboarding
  app.get('/api/team-members', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const managerId = (req as AuthenticatedRequest).user.claims.sub;
      const members = await storage.getTeamMembers(managerId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  app.post('/api/team-members', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const managerId = (req as AuthenticatedRequest).user.claims.sub;
      const validatedData = insertTeamMemberSchema.parse({
        ...req.body,
        managerId
      });
      const member = await storage.createTeamMember(validatedData);
      res.json(member);
    } catch (error) {
      console.error("Error creating team member:", error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to create team member", error: msg });
    }
  });

  app.put('/api/team-members/:id', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validatedData = updateTeamMemberSchema.parse(req.body);
      const member = await storage.updateTeamMember(id, validatedData);
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      console.error("Error updating team member:", error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to update team member", error: msg });
    }
  });

  app.delete('/api/team-members/:id', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await storage.deleteTeamMember(id);
      res.json({ message: "Team member deleted successfully" });
    } catch (error) {
      console.error("Error deleting team member:", error);
      res.status(500).json({ message: "Failed to delete team member" });
    }
  });

  // AI Insights routes - require authentication and completed onboarding
  app.post('/api/generate-team-insight', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.claims.sub;
      const user = await storage.getUser(userId);
      const teamMembers = await storage.getTeamMembers(userId);
      if (!user || !user.topStrengths) {
        throw errors.validation('User strengths not found. Please complete your onboarding first.');
      }
      if (teamMembers.length === 0) {
        throw errors.validation('No team members found. Please add team members before generating insights.');
      }
      const teamData = {
        managerStrengths: user.topStrengths,
        teamMembers: teamMembers.map(member => ({
          name: member.name,
          strengths: member.strengths
        }))
      };
      const insight = await generateTeamInsight(teamData);
      res.json(createSuccessResponse(
        { insight, generatedAt: new Date().toISOString() }, 
        req.headers['x-request-id'] as string
      ));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/generate-collaboration-insight', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { member1, member2 } = req.body;
      if (!member1 || !member2) {
        throw errors.validation('Both team members must be specified', {
          required: ['member1', 'member2'],
          received: { member1: !!member1, member2: !!member2 }
        });
      }
      if (member1 === member2) {
        throw errors.validation('Cannot generate collaboration insight for the same member');
      }
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.claims.sub;
      const user = await storage.getUser(userId);
      const teamMembers = await storage.getTeamMembers(userId);
      let member1Strengths: string[] = [];
      let member2Strengths: string[] = [];
      if (member1 === 'You') {
        member1Strengths = user?.topStrengths || [];
      } else {
        const teamMember = teamMembers.find(m => m.name === member1);
        member1Strengths = teamMember?.strengths || [];
      }
      if (member2 === 'You') {
        member2Strengths = user?.topStrengths || [];
      } else {
        const teamMember = teamMembers.find(m => m.name === member2);
        member2Strengths = teamMember?.strengths || [];
      }
      const insight = await generateCollaborationInsight(member1, member2, member1Strengths, member2Strengths);
      res.json(createSuccessResponse(
        { insight, generatedAt: new Date().toISOString() },
        req.headers['x-request-id'] as string
      ));
    } catch (error) {
      next(error);
    }
  });

  // File upload endpoint for team members
  // Chat conversation management routes
  app.get('/api/conversations', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      const conversations = await storage.getConversations(userId);
      
      res.json(createSuccessResponse(conversations));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/conversations/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user || !authReq.user.claims || !authReq.user.claims.sub) {
        console.error('Authentication failed - no user or claims found');
        return res.status(401).json(createErrorResponse(req, new AppError(ERROR_CODES.VALIDATION_ERROR, 'Authentication required', 401)));
      }
      
      const userId = authReq.user.claims.sub;
      console.log(`Loading conversation ${id} for user ${userId}`);
      
      const result = await storage.getConversationWithMessages(id, userId);
      if (!result) {
        console.log('Conversation not found or access denied');
        return res.status(404).json(createErrorResponse(req, new AppError(ERROR_CODES.VALIDATION_ERROR, 'Conversation not found', 404)));
      }
      
      console.log('Successfully loaded conversation with', result.messages.length, 'messages');
      res.json(createSuccessResponse(result));
    } catch (error) {
      console.error('Error loading conversation:', error);
      next(error);
    }
  });

  app.post('/api/conversations', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      const validatedData = insertConversationSchema.parse(req.body);
      
      const conversation = await storage.createConversation(userId, validatedData);
      
      res.json(createSuccessResponse(conversation));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/conversations/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      
      // Log the incoming data for debugging
      console.log('Update conversation request body:', JSON.stringify(req.body, null, 2));
      
      const validatedData = updateConversationSchema.parse(req.body);
      
      const conversation = await storage.updateConversation(id, userId, validatedData);
      if (!conversation) {
        return res.status(404).json(createErrorResponse(req, new AppError(ERROR_CODES.VALIDATION_ERROR, 'Conversation not found', 404)));
      }
      
      res.json(createSuccessResponse(conversation));
    } catch (error) {
      console.error('Conversation update error:', error);
      next(error);
    }
  });

  app.delete('/api/conversations/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      
      await storage.deleteConversation(id, userId);
      
      res.json(createSuccessResponse({ deleted: true }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/conversations/:id/archive', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      
      await storage.archiveConversation(id, userId);
      
      res.json(createSuccessResponse({ archived: true }));
    } catch (error) {
      next(error);
    }
  });

  // Message management routes
  app.post('/api/conversations/:id/messages', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      
      // Verify conversation ownership
      const conversation = await storage.getConversation(id, userId);
      if (!conversation) {
        return res.status(404).json(createErrorResponse(req, new AppError(ERROR_CODES.VALIDATION_ERROR, 'Conversation not found', 404)));
      }
      
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        conversationId: id
      });
      
      const message = await storage.createMessage(validatedData);
      
      res.json(createSuccessResponse(message));
    } catch (error) {
      next(error);
    }
  });

  // Migration and backup routes
  // TODO: Implement migration/export/recover logic

  app.post('/api/chat-with-coach', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, mode, conversationHistory } = req.body;
      
      if (!message || typeof message !== 'string') {
        throw new AppError('Message is required', ERROR_CODES.VALIDATION_ERROR, 400);
      }

      if (!mode || !['personal', 'team'].includes(mode)) {
        throw new AppError('Valid mode (personal or team) is required', ERROR_CODES.VALIDATION_ERROR, 400);
      }

      // Get user data for context
      const authReq = req as AuthenticatedRequest;
      const user = await storage.getUser(authReq.user.claims.sub);
      if (!user) {
        throw new AppError('User not found', ERROR_CODES.VALIDATION_ERROR, 404);
      }

      const teamMembers = await storage.getTeamMembers(authReq.user.claims.sub);
      
      // Generate AI response using the coaching system prompt
      const response = await generateCoachResponse(message, mode, user, teamMembers, conversationHistory);
      
      res.json(createSuccessResponse({ response }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/upload-team-members', isAuthenticated, requireOnboarding, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      if (!req.file) {
        throw errors.validation('No file uploaded', { field: 'file' });
      }

      const userId = (req as AuthenticatedRequest).user.claims.sub;
      const { buffer, mimetype, originalname } = req.file;
      const requestId = req.headers['x-request-id'] as string;
      
      // Log upload attempt for security monitoring
      console.log(`File upload attempt: ${originalname} (${mimetype}) by user ${userId} [${requestId}]`);
      
      // Rate limiting: max 50 team members per upload
      const maxMembers = 50;
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      
      if (buffer.length > maxFileSize) {
        throw errors.fileTooLarge('5MB');
      }
      
      const teamMembers = await parseTeamMembersFile(buffer, mimetype, originalname);

      if (teamMembers.length === 0) {
        throw errors.validation('No valid team member data found in file. Please check the file format and content.');
      }

      if (teamMembers.length > maxMembers) {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          `Too many team members in file. Maximum ${maxMembers} members allowed per upload.`,
          413,
          { maxAllowed: maxMembers, found: teamMembers.length }
        );
      }

      // Create team members in database
      const createdMembers = [];
      const processingErrors = [];

      for (const memberData of teamMembers) {
        try {
          // Validate using schema
          const validatedData = insertTeamMemberSchema.parse({
            managerId: userId,
            name: memberData.name.trim(),
            strengths: memberData.strengths
          });

          const member = await storage.createTeamMember(validatedData);
          createdMembers.push(member);
        } catch (error) {
          console.error(`Failed to create team member ${memberData.name}:`, error);
          processingErrors.push({
            name: memberData.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Try bulk insert for remaining members if we have valid data
      if (processingErrors.length === 0 && teamMembers.length > 5) {
        try {
          // Use bulk operation for better performance with large datasets
          const validMembersData = teamMembers.map(memberData => ({
            name: memberData.name.trim(),
            strengths: memberData.strengths
          }));
          
          const bulkCreated = await storage.createMultipleTeamMembers(userId, validMembersData);
          createdMembers.push(...bulkCreated);
        } catch (bulkError) {
          console.error('Bulk insert failed, falling back to individual inserts:', bulkError);
          // Fallback handled above in the loop
        }
      }

      // Log processing time
      const processingTime = Date.now() - startTime;
      console.log(`File processing completed in ${processingTime}ms [${requestId}]`);

      const responseData = {
        imported: createdMembers,
        summary: {
          total_processed: teamMembers.length,
          successful: createdMembers.length,
          failed: processingErrors.length,
          processing_time_ms: processingTime
        },
        errors: processingErrors.length > 0 ? processingErrors : undefined
      };

      res.json(createSuccessResponse(responseData, requestId));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error("File upload error:", error);
      
      // Add processing time to error context
      if (error instanceof AppError) {
        if (error.context && typeof error.context === 'object') {
          (error.context as any).processing_time_ms = processingTime;
        }
      }
      
      next(error);
    }
  });

  // Context-aware starter questions endpoint
  app.post('/api/context-starter-questions', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      const user = await storage.getUser(userId);
      const teamMembers = await storage.getTeamMembers(userId);
      const recentTopics = req.body.recentTopics || [];
      const questions = await generateContextAwareStarterQuestions(user, teamMembers, recentTopics);
      res.json(createSuccessResponse({ questions }));
    } catch (error) {
      next(error);
    }
  });

  // Follow-up questions endpoint
  app.post('/api/followup-questions', isAuthenticated, requireOnboarding, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { aiAnswer, conversationHistory } = req.body;
      if (!aiAnswer) {
        throw errors.validation('AI answer is required');
      }
      const questions = await generateFollowUpQuestions(aiAnswer, conversationHistory || []);
      res.json(createSuccessResponse({ questions }));
    } catch (error) {
      next(error);
    }
  });

  // Email management routes
  app.get('/api/email-subscriptions', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      const subscriptions = await storage.getEmailSubscriptions(userId);
      
      res.json(createSuccessResponse(subscriptions));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/email-subscriptions/:type', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      const { type } = req.params;
      const { isActive, timezone } = req.body;

      if (!['welcome', 'weekly_coaching'].includes(type)) {
        return res.status(400).json(createErrorResponse(req, new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid email type', 400)));
      }

      const subscription = await storage.updateEmailSubscription(userId, type as 'welcome' | 'weekly_coaching', {
        isActive,
        timezone
      });

      res.json(createSuccessResponse(subscription));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/email-logs', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.claims.sub;
      const logs = await storage.getEmailLogs(userId);
      
      res.json(createSuccessResponse(logs));
    } catch (error) {
      next(error);
    }
  });

  // Admin routes
  app.get('/api/admin/health', async (req, res) => {
    try {
      // Check if user is admin
      const user = req.user as any;
      if (!user || user.email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // System health checks
      const health = {
        database: 'unknown',
        openai: 'unknown',
        resend: 'unknown',
        timestamp: new Date().toISOString()
      };

      // Test database
      try {
        await db.execute(sql`SELECT 1`);
        health.database = 'healthy';
      } catch (error) {
        health.database = 'error';
      }

      // Test OpenAI
      try {
        if (process.env.OPENAI_API_KEY) {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          await openai.models.list();
          health.openai = 'healthy';
        } else {
          health.openai = 'no_key';
        }
      } catch (error) {
        health.openai = 'error';
      }

      // Test Resend
      try {
        if (process.env.RESEND_API_KEY) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.domains.list();
          health.resend = 'healthy';
        } else {
          health.resend = 'no_key';
        }
      } catch (error) {
        health.resend = 'error';
      }

      res.json(health);
    } catch (error) {
      res.status(500).json({ error: 'Health check failed' });
    }
  });

  app.get('/api/admin/users', async (req, res) => {
    try {
      const user = req.user as any;
      if (!user || user.email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          hasCompletedOnboarding: users.hasCompletedOnboarding,
          topStrengths: users.topStrengths,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.delete('/api/admin/users/:userId', async (req, res) => {
    try {
      const user = req.user as any;
      if (!user || user.email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { userId } = req.params;
      
      // Delete user and all related data (cascade)
      await db.delete(users).where(eq(users.id, userId));
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  app.get('/api/admin/emails', async (req, res) => {
    try {
      const user = req.user as any;
      if (!user || user.email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const emailLogsData = await db
        .select()
        .from(emailLogs)
        .orderBy(desc(emailLogs.createdAt))
        .limit(100);

      res.json(emailLogsData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch email logs' });
    }
  });

  app.post('/api/admin/emails/test', async (req, res) => {
    try {
      const user = req.user as any;
      if (!user || user.email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { emailType, userId } = req.body;
      
      const targetUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then(results => results[0]);

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const emailService = new EmailService();
      
      if (emailType === 'welcome') {
        await emailService.sendWelcomeEmail(targetUser);
      } else if (emailType === 'weekly') {
        const weekNumber = 1; // Test with week 1
        await emailService.sendWeeklyCoachingEmail(targetUser, weekNumber);
      }

      res.json({ success: true, message: `${emailType} email sent to ${targetUser.email}` });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send test email' });
    }
  });

  app.post('/api/admin/emails/send-weekly', async (req, res) => {
    try {
      const user = req.user as any;
      if (!user || user.email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const emailService = new EmailService();
      await emailService.processWeeklyEmails();
      
      res.json({ success: true, message: 'Weekly emails processed' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process weekly emails' });
    }
  });

  app.get('/api/admin/analytics', async (req, res) => {
    try {
      const user = req.user as any;
      if (!user || user.email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // User analytics
      const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
      const onboardedUsers = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.hasCompletedOnboarding, true));
      
      // Email analytics
      const totalEmails = await db.select({ count: sql<number>`count(*)` }).from(emailLogs);
      const sentEmails = await db.select({ count: sql<number>`count(*)` }).from(emailLogs).where(eq(emailLogs.status, 'sent'));
      const failedEmails = await db.select({ count: sql<number>`count(*)` }).from(emailLogs).where(eq(emailLogs.status, 'failed'));

      // Recent activity
      const recentUsers = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(gte(users.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));

      const recentEmails = await db
        .select({ count: sql<number>`count(*)` })
        .from(emailLogs)
        .where(gte(emailLogs.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));

      res.json({
        users: {
          total: totalUsers[0]?.count || 0,
          onboarded: onboardedUsers[0]?.count || 0,
          recent: recentUsers[0]?.count || 0,
        },
        emails: {
          total: totalEmails[0]?.count || 0,
          sent: sentEmails[0]?.count || 0,
          failed: failedEmails[0]?.count || 0,
          recent: recentEmails[0]?.count || 0,
        },
        deliveryRate: totalEmails[0]?.count ? Math.round((sentEmails[0]?.count || 0) / totalEmails[0].count * 100) : 0,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // Setup admin user endpoint (one-time use)
  app.post('/api/admin/setup', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (email !== 'tinymanagerai@gmail.com') {
        return res.status(403).json({ error: 'Invalid admin email' });
      }

      // Find user by email
      const [user] = await db.select().from(users).where(eq(users.email, email));
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update user to admin
      await storage.updateUserAdminStatus(user.id, true);
      
      res.json({ success: true, message: 'Admin privileges granted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to setup admin' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
