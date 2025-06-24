import { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server } from 'http';
import multer from 'multer';
import { isAuthenticated, setupAuth } from './replitAuth';
import { storage } from './storage';
import { parseTeamMembersFile } from './fileParser';
import { generateTeamInsight, generateCollaborationInsight, generateCoachResponse } from './openai';
import { errors, createSuccessResponse, createErrorResponse, AppError, ERROR_CODES } from './errorHandler';
import { 
  insertTeamMemberSchema, 
  updateTeamMemberSchema, 
  updateUserOnboardingSchema,
  insertConversationSchema,
  insertMessageSchema,
  updateConversationSchema,
  insertConversationBackupSchema
} from '../shared/schema';

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
const requireOnboarding = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.claims.sub;
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
        return cb(errors.unsupportedFileType([
          'CSV', 'Excel (.xls, .xlsx)', 'Word (.docx)', 'PNG', 'JPEG'
        ]), false);
      }
      
      // Validate file extension matches MIME type
      const fileExtension = file.originalname.toLowerCase().split('.').pop();
      const mimeToExtension = {
        'text/csv': ['csv'],
        'application/vnd.ms-excel': ['xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
        'image/png': ['png'],
        'image/jpeg': ['jpg', 'jpeg']
      };
      
      const allowedExtensions = mimeToExtension[file.mimetype] || [];
      if (!allowedExtensions.includes(fileExtension)) {
        return cb(errors.validation('File extension does not match file type'), false);
      }
      
      // Validate filename for security
      if (!/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
        return cb(errors.validation('Invalid filename. Only alphanumeric characters, dots, hyphens, and underscores are allowed.'), false);
      }
      
      cb(null, true);
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Onboarding route
  app.post('/api/onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log('Onboarding request:', { userId, body: req.body });
      
      // Validate the request body
      const validatedData = updateUserOnboardingSchema.parse(req.body);
      console.log('Validated data:', validatedData);
      
      const user = await storage.updateUserOnboarding(userId, validatedData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log('Updated user:', user);
      res.json(user);
    } catch (error) {
      console.error("Error updating onboarding:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        res.status(500).json({ message: "Failed to update onboarding", error: error.message });
      } else {
        res.status(500).json({ message: "Failed to update onboarding", error: String(error) });
      }
    }
  });

  // Team member routes - require authentication and completed onboarding
  app.get('/api/team-members', isAuthenticated, requireOnboarding, async (req: any, res) => {
    try {
      const managerId = req.user.claims.sub;
      const members = await storage.getTeamMembers(managerId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  app.post('/api/team-members', isAuthenticated, requireOnboarding, async (req: any, res) => {
    try {
      const managerId = req.user.claims.sub;
      const validatedData = insertTeamMemberSchema.parse({
        ...req.body,
        managerId
      });
      
      const member = await storage.createTeamMember(validatedData);
      res.json(member);
    } catch (error) {
      console.error("Error creating team member:", error);
      if (error instanceof Error) {
        res.status(500).json({ message: "Failed to create team member", error: error.message });
      } else {
        res.status(500).json({ message: "Failed to create team member", error: String(error) });
      }
    }
  });

  app.put('/api/team-members/:id', isAuthenticated, requireOnboarding, async (req: any, res) => {
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
      if (error instanceof Error) {
        res.status(500).json({ message: "Failed to update team member", error: error.message });
      } else {
        res.status(500).json({ message: "Failed to update team member", error: String(error) });
      }
    }
  });

  app.delete('/api/team-members/:id', isAuthenticated, requireOnboarding, async (req: any, res) => {
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
  app.post('/api/generate-team-insight', isAuthenticated, requireOnboarding, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.claims.sub;
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

  app.post('/api/generate-collaboration-insight', isAuthenticated, requireOnboarding, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const teamMembers = await storage.getTeamMembers(userId);

      let member1Strengths: string[] = [];
      let member2Strengths: string[] = [];

      // Get strengths for member1
      if (member1 === 'You') {
        member1Strengths = user?.topStrengths || [];
      } else {
        const teamMember = teamMembers.find(m => m.name === member1);
        member1Strengths = teamMember?.strengths || [];
      }

      // Get strengths for member2
      if (member2 === 'You') {
        member2Strengths = user?.topStrengths || [];
      } else {
        const teamMember = teamMembers.find(m => m.name === member2);
        member2Strengths = teamMember?.strengths || [];
      }

      if (member1Strengths.length === 0) {
        throw errors.notFound(`Strengths for ${member1}`);
      }

      if (member2Strengths.length === 0) {
        throw errors.notFound(`Strengths for ${member2}`);
      }

      const insight = await generateCollaborationInsight(member1, member2, member1Strengths, member2Strengths);
      
      res.json(createSuccessResponse(
        { 
          insight, 
          members: { member1, member2 },
          generatedAt: new Date().toISOString()
        }, 
        req.headers['x-request-id'] as string
      ));
    } catch (error) {
      next(error);
    }
  });

  // File upload endpoint for team members
  // Chat conversation management routes
  app.get('/api/conversations', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversations(userId);
      
      res.json(createSuccessResponse(conversations));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/conversations/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const conversation = await storage.getConversation(id, userId);
      if (!conversation) {
        return res.status(404).json(createErrorResponse(req, new AppError(ERROR_CODES.NOT_FOUND, 'Conversation not found', 404)));
      }
      
      const messages = await storage.getMessages(id, userId);
      
      res.json(createSuccessResponse({ conversation, messages }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/conversations', isAuthenticated, requireOnboarding, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertConversationSchema.parse(req.body);
      
      const conversation = await storage.createConversation(userId, validatedData);
      
      res.json(createSuccessResponse(conversation));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/conversations/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Log the incoming data for debugging
      console.log('Update conversation request body:', JSON.stringify(req.body, null, 2));
      
      const validatedData = updateConversationSchema.parse(req.body);
      
      const conversation = await storage.updateConversation(id, userId, validatedData);
      if (!conversation) {
        return res.status(404).json(createErrorResponse(req, new AppError(ERROR_CODES.NOT_FOUND, 'Conversation not found', 404)));
      }
      
      res.json(createSuccessResponse(conversation));
    } catch (error) {
      console.error('Conversation update error:', error);
      next(error);
    }
  });

  app.delete('/api/conversations/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.deleteConversation(id, userId);
      
      res.json(createSuccessResponse({ deleted: true }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/conversations/:id/archive', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.archiveConversation(id, userId);
      
      res.json(createSuccessResponse({ archived: true }));
    } catch (error) {
      next(error);
    }
  });

  // Message management routes
  app.post('/api/conversations/:id/messages', isAuthenticated, requireOnboarding, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify conversation ownership
      const conversation = await storage.getConversation(id, userId);
      if (!conversation) {
        return res.status(404).json(createErrorResponse(req, new AppError(ERROR_CODES.NOT_FOUND, 'Conversation not found', 404)));
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
  app.post('/api/conversations/migrate', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.claims.sub;
      const { localStorageData } = req.body;
      
      if (!localStorageData) {
        return res.status(400).json(createErrorResponse(req, new AppError(ERROR_CODES.VALIDATION_ERROR, 'localStorage data is required', 400)));
      }
      
      const result = await chatService.migrateFromLocalStorage(userId, localStorageData);
      
      if (result.success) {
        res.json(createSuccessResponse(result));
      } else {
        res.status(400).json(createErrorResponse(req, new AppError(ERROR_CODES.MIGRATION_FAILED, result.error || 'Migration failed', 400)));
      }
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/conversations/export', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.claims.sub;
      const exportData = await chatService.exportConversations(userId);
      
      res.json(createSuccessResponse(exportData));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/conversations/backups', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.claims.sub;
      const backups = await storage.getConversationBackups(userId);
      
      res.json(createSuccessResponse(backups));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/conversations/restore/:backupId', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { backupId } = req.params;
      const userId = req.user.claims.sub;
      
      const restoredConversations = await storage.restoreConversationBackup(backupId, userId);
      
      res.json(createSuccessResponse({ restored: restoredConversations.length, conversations: restoredConversations }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/conversations/recover', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.claims.sub;
      const { partialData } = req.body;
      
      const result = await chatService.handleCorruptedLocalStorage(userId, partialData);
      
      res.json(createSuccessResponse(result));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/chat-with-coach', isAuthenticated, requireOnboarding, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { message, mode, conversationHistory } = req.body;
      
      if (!message || typeof message !== 'string') {
        throw new AppError('Message is required', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      if (!mode || !['personal', 'team'].includes(mode)) {
        throw new AppError('Valid mode (personal or team) is required', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      // Get user data for context
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        throw new AppError('User not found', 404, ERROR_CODES.USER_NOT_FOUND);
      }

      const teamMembers = await storage.getTeamMembers(req.user.claims.sub);
      
      // Generate AI response using the coaching system prompt
      const response = await generateCoachResponse(message, mode, user, teamMembers, conversationHistory);
      
      res.json(createSuccessResponse({ response }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/upload-team-members', isAuthenticated, requireOnboarding, upload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      if (!req.file) {
        throw errors.validation('No file uploaded', { field: 'file' });
      }

      const userId = req.user.claims.sub;
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
          'RESOURCE_LIMIT_EXCEEDED',
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
        error.context = { ...error.context, processing_time_ms: processingTime };
      }
      
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
