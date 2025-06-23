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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
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
  }

  async updateUserOnboarding(id: string, data: UpdateUserOnboarding): Promise<User | undefined> {
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.hasCompletedOnboarding !== undefined) {
      updateData.hasCompletedOnboarding = data.hasCompletedOnboarding;
    }
    
    if (data.topStrengths) {
      updateData.topStrengths = JSON.stringify(data.topStrengths);
    }

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
