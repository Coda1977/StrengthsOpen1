import {
  users,
  teamMembers,
  type User,
  type UpsertUser,
  type UpdateUserOnboarding,
  type TeamMember,
  type InsertTeamMember,
  type UpdateTeamMember,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserOnboarding(id: string, data: UpdateUserOnboarding): Promise<User | undefined>;
  
  // Team member operations
  getTeamMembers(managerId: string): Promise<TeamMember[]>;
  createTeamMember(data: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, data: UpdateTeamMember): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const [user] = await db
          .insert(users)
          .values(userData)
          .onConflictDoUpdate({
            target: users.id,
            set: {
              ...userData,
              updatedAt: new Date(),
            },
          })
          .returning();
        return user;
      } catch (error) {
        attempt++;
        console.error(`Error upserting user (attempt ${attempt}):`, error);
        
        // Retry on connection errors
        if (error.code === '57P01' && attempt < maxRetries) {
          console.log('Retrying due to connection termination...');
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to upsert user after retries');
  }

  async updateUserOnboarding(id: string, data: UpdateUserOnboarding): Promise<User | undefined> {
    try {
      const [user] = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      return user;
    } catch (error) {
      console.error('Error updating user onboarding:', error);
      throw error;
    }
  }

  // Team member operations
  async getTeamMembers(managerId: string): Promise<TeamMember[]> {
    try {
      return await db.select().from(teamMembers).where(eq(teamMembers.managerId, managerId));
    } catch (error) {
      console.error('Error getting team members:', error);
      // Return empty array for database errors but log them
      if (error.message?.includes('FATAL') || error.code === '57P01') {
        console.warn('Database connection issue, returning empty team members list');
      }
      return [];
    }
  }

  async createTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const [member] = await db
          .insert(teamMembers)
          .values(data)
          .returning();
        return member;
      } catch (error) {
        attempt++;
        console.error(`Error creating team member (attempt ${attempt}):`, error);
        
        // Retry on connection errors
        if (error.code === '57P01' && attempt < maxRetries) {
          console.log('Retrying due to connection termination...');
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to create team member after retries');
  }

  async updateTeamMember(id: string, data: UpdateTeamMember): Promise<TeamMember | undefined> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const [member] = await db
          .update(teamMembers)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(teamMembers.id, id))
          .returning();
        return member;
      } catch (error) {
        attempt++;
        console.error(`Error updating team member (attempt ${attempt}):`, error);
        
        // Retry on connection errors
        if (error.code === '57P01' && attempt < maxRetries) {
          console.log('Retrying due to connection termination...');
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to update team member after retries');
  }

  async deleteTeamMember(id: string): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  }
}

export const storage = new DatabaseStorage();
