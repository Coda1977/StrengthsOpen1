import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { updateUserOnboardingSchema, insertTeamMemberSchema, updateTeamMemberSchema } from "@shared/schema";
import { updateUserOnboardingSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
