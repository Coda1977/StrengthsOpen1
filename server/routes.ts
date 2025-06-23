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

// Add authentication middleware with better typing
const authenticatedMiddleware = (req: Request, res: Response, next: NextFunction) => {
  isAuthenticated(req, res, (err?: any) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // File upload middleware
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'image/png',
        'image/jpeg',
        'image/jpg'
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Unsupported file type'), false);
      }
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

  // Team member routes
  app.get('/api/team-members', isAuthenticated, async (req: any, res) => {
    try {
      const managerId = req.user.claims.sub;
      const members = await storage.getTeamMembers(managerId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  app.post('/api/team-members', isAuthenticated, async (req: any, res) => {
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

  app.put('/api/team-members/:id', isAuthenticated, async (req: any, res) => {
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

  app.delete('/api/team-members/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTeamMember(id);
      res.json({ message: "Team member deleted successfully" });
    } catch (error) {
      console.error("Error deleting team member:", error);
      res.status(500).json({ message: "Failed to delete team member" });
    }
  });

  // AI Insights routes
  app.post('/api/generate-team-insight', isAuthenticated, async (req: any, res) => {
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

  app.post('/api/generate-collaboration-insight', isAuthenticated, async (req: any, res) => {
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
  app.post('/api/upload-team-members', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const teamMembers = await parseTeamMembersFile(req.file.buffer, req.file.mimetype, req.file.originalname);

      if (teamMembers.length === 0) {
        return res.status(400).json({ message: "No valid team members found in the file" });
      }

      // Create team members in database
      const createdMembers = [];
      for (const member of teamMembers) {
        try {
          const created = await storage.createTeamMember({
            managerId: userId,
            name: member.name,
            strengths: member.strengths
          });
          createdMembers.push(created);
        } catch (error) {
          console.error(`Failed to create team member ${member.name}:`, error);
          // Continue with other members even if one fails
        }
      }

      res.json({ 
        message: `Successfully created ${createdMembers.length} team members`,
        members: createdMembers,
        totalParsed: teamMembers.length
      });
    } catch (error) {
      console.error("Error uploading team members file:", error);
      res.status(500).json({ message: error.message || "Failed to process file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
