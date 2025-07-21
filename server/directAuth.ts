import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// Simple direct auth bypass for admin access
export async function directAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check if this is a direct auth request
  const directAuthEmail = req.query.directAuth as string;
  
  if (directAuthEmail === 'codanudge@gmail.com') {
    try {
      // Get or create admin user
      let user = await storage.getUserByEmail(directAuthEmail);
      
      if (!user) {
        // Create admin user if doesn't exist
        const adminId = 'admin-' + Date.now();
        user = await storage.upsertUser({
          id: adminId,
          email: directAuthEmail,
          firstName: 'Admin',
          lastName: 'User',
        });
        
        // Update to admin and completed onboarding
        await storage.updateUserOnboarding(adminId, {
          hasCompletedOnboarding: true,
          topStrengths: ['Strategic', 'Achiever', 'Developer', 'Analytical', 'Focus']
        });
        
        user = await storage.getUser(adminId);
      }
      
      // Create session manually
      const sessionUser = {
        claims: {
          sub: user!.id,
          email: user!.email,
          first_name: user!.firstName,
          last_name: user!.lastName,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        },
        expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
      };
      
      req.login(sessionUser, (err) => {
        if (err) {
          console.error('Direct auth login error:', err);
          return next();
        }
        return res.redirect('/dashboard');
      });
      
    } catch (error) {
      console.error('Direct auth error:', error);
      return next();
    }
  } else {
    next();
  }
}