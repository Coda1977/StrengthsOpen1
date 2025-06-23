import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertTeamMemberSchema, updateTeamMemberSchema } from "@shared/schema";
import { updateUserOnboardingSchema } from "@shared/schema";
import { generateTeamInsight, generateCollaborationInsight } from "./openai";
import { parseTeamMembersFile } from "./fileParser";
import multer from "multer";

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
        return cb(new Error('File type not allowed. Only CSV, Excel, Word, PNG, and JPEG files are supported.'), false);
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
        return cb(new Error('File extension does not match file type'), false);
      }
      
      // Validate filename for security
      if (!/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
        return cb(new Error('Invalid filename. Only alphanumeric characters, dots, hyphens, and underscores are allowed.'), false);
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
  app.post('/api/generate-team-insight', isAuthenticated, requireOnboarding, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const teamMembers = await storage.getTeamMembers(userId);

      if (!user || !user.topStrengths) {
        return res.status(400).json({ message: "User strengths not found" });
      }

      const teamData = {
        managerStrengths: user.topStrengths,
        teamMembers: teamMembers.map(member => ({
          name: member.name,
          strengths: member.strengths
        }))
      };

      const insight = await generateTeamInsight(teamData);
      res.json({ insight });
    } catch (error) {
      console.error("Error generating team insight:", error);
      res.status(500).json({ message: "Failed to generate team insight" });
    }
  });

  app.post('/api/generate-collaboration-insight', isAuthenticated, requireOnboarding, async (req: any, res) => {
    try {
      const { member1, member2 } = req.body;
      
      if (!member1 || !member2) {
        return res.status(400).json({ message: "Both members must be specified" });
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

      if (member1Strengths.length === 0 || member2Strengths.length === 0) {
        return res.status(400).json({ message: "Member strengths not found" });
      }

      const insight = await generateCollaborationInsight(member1, member2, member1Strengths, member2Strengths);
      res.json({ insight });
    } catch (error) {
      console.error("Error generating collaboration insight:", error);
      res.status(500).json({ message: "Failed to generate collaboration insight" });
    }
  });

  // File upload endpoint for team members
  app.post('/api/upload-team-members', isAuthenticated, requireOnboarding, upload.single('file'), async (req: any, res) => {
    const startTime = Date.now();
    let processed = false;
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const { buffer, mimetype, originalname } = req.file;
      
      // Log upload attempt for security monitoring
      console.log(`File upload attempt: ${originalname} (${mimetype}) by user ${userId}`);
      
      // Rate limiting: max 50 team members per upload
      const maxMembers = 50;
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      
      if (buffer.length > maxFileSize) {
        return res.status(400).json({ 
          message: "File too large. Maximum file size is 5MB." 
        });
      }
      
      const teamMembers = await parseTeamMembersFile(buffer, mimetype, originalname);
      processed = true;

      if (teamMembers.length === 0) {
        return res.status(400).json({ message: "No valid team member data found in file" });
      }

      if (teamMembers.length > maxMembers) {
        return res.status(400).json({ 
          message: `Too many team members in file. Maximum ${maxMembers} members allowed per upload.` 
        });
      }

      // Create team members in database
      const createdMembers = [];
      const errors = [];

      for (const memberData of teamMembers) {
        try {
          // Additional validation
          if (!memberData.name || memberData.name.length > 100) {
            errors.push(`Invalid name: ${memberData.name}`);
            continue;
          }
          
          if (!Array.isArray(memberData.strengths) || memberData.strengths.length === 0) {
            errors.push(`No valid strengths for ${memberData.name}`);
            continue;
          }

          const member = await storage.createTeamMember({
            managerId: userId,
            name: memberData.name.trim(),
            strengths: memberData.strengths
          });
          createdMembers.push(member);
        } catch (error) {
          console.error(`Failed to create team member ${memberData.name}:`, error);
          errors.push(`Failed to create ${memberData.name}: ${error.message}`);
        }
      }

      // Log processing time
      const processingTime = Date.now() - startTime;
      console.log(`File processing completed in ${processingTime}ms`);

      res.json({
        message: `Successfully imported ${createdMembers.length} team members`,
        members: createdMembers,
        errors: errors.length > 0 ? errors : undefined,
        total_processed: teamMembers.length,
        successful: createdMembers.length,
        failed: errors.length,
        processing_time_ms: processingTime
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error("File upload error:", error);
      console.log(`File processing failed after ${processingTime}ms`);
      
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process uploaded file",
        processing_time_ms: processingTime
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
