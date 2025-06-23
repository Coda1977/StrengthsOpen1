import { db } from './db';
import { users, teamMembers, type User, type UpsertUser, type UpdateUserOnboarding, type TeamMember, type InsertTeamMember, type UpdateTeamMember } from '../shared/schema';
import { eq, and, inArray, sql, count } from 'drizzle-orm';
import crypto from 'crypto';

// Interface for storage operations
export interface IStorage {
  // User operations
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
  // Enhanced caching with LRU-like behavior
  private userCache = new Map<string, { user: User; timestamp: number }>();
  private teamMembersCache = new Map<string, { members: TeamMember[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Prevent memory leaks

  private getCachedUser(id: string): User | null {
    const cached = this.userCache.get(id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      // Move to end (LRU behavior)
      this.userCache.delete(id);
      this.userCache.set(id, cached);
      return cached.user;
    }
    this.userCache.delete(id);
    return null;
  }

  private setCachedUser(id: string, user: User): void {
    // Implement LRU eviction
    if (this.userCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.userCache.keys().next().value;
      this.userCache.delete(firstKey);
    }
    this.userCache.set(id, { user, timestamp: Date.now() });
  }

  private getCachedTeamMembers(managerId: string): TeamMember[] | null {
    const cached = this.teamMembersCache.get(managerId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      // Move to end (LRU behavior)
      this.teamMembersCache.delete(managerId);
      this.teamMembersCache.set(managerId, cached);
      return cached.members;
    }
    this.teamMembersCache.delete(managerId);
    return null;
  }

  private setCachedTeamMembers(managerId: string, members: TeamMember[]): void {
    // Implement LRU eviction
    if (this.teamMembersCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.teamMembersCache.keys().next().value;
      this.teamMembersCache.delete(firstKey);
    }
    this.teamMembersCache.set(managerId, { members, timestamp: Date.now() });
  }

  private invalidateTeamMembersCache(managerId: string): void {
    this.teamMembersCache.delete(managerId);
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    
    // Clear expired user cache entries
    for (const [key, value] of this.userCache.entries()) {
      if (now - value.timestamp >= this.CACHE_TTL) {
        this.userCache.delete(key);
      }
    }
    
    // Clear expired team members cache entries
    for (const [key, value] of this.teamMembersCache.entries()) {
      if (now - value.timestamp >= this.CACHE_TTL) {
        this.teamMembersCache.delete(key);
      }
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    try {
      // Check cache first
      const cached = this.getCachedUser(id);
      if (cached) {
        return cached;
      }

      const [user] = await db.select().from(users).where(eq(users.id, id));
      
      if (user) {
        this.setCachedUser(id, user);
      }
      
      return user;
    } catch (error) {
      console.error('Failed to get user:', error);
      throw new Error('Failed to fetch user');
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
        }
      }).returning();
      
      // Update cache
      this.setCachedUser(user.id, user);
      
      return user;
    } catch (error) {
      console.error('Failed to upsert user:', error);
      throw new Error('Failed to save user');
    }
  }

  async updateUserOnboarding(id: string, data: UpdateUserOnboarding): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(data)
        .where(eq(users.id, id))
        .returning();
      
      if (updatedUser) {
        this.setCachedUser(id, updatedUser);
      }
      
      return updatedUser;
    } catch (error) {
      console.error('Failed to update user onboarding:', error);
      throw new Error('Failed to update user onboarding');
    }
  }

  // Team member operations with optimization
  async getTeamMembers(managerId: string): Promise<TeamMember[]> {
    try {
      // Check cache first
      const cached = this.getCachedTeamMembers(managerId);
      if (cached) {
        return cached;
      }

      // Optimized query with proper indexing
      const members = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.managerId, managerId))
        .orderBy(teamMembers.name);

      // Cache the result
      this.setCachedTeamMembers(managerId, members);
      
      return members;
    } catch (error) {
      console.error('Failed to get team members:', error);
      throw new Error('Failed to fetch team members');
    }
  }

  async createTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    try {
      // Check for duplicate names within the same manager
      const existingMember = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.managerId, data.managerId),
            eq(teamMembers.name, data.name)
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        throw new Error(`Team member with name "${data.name}" already exists`);
      }

      const id = this.generateSecureId();
      const [teamMember] = await db.insert(teamMembers).values({
        ...data,
        id
      }).returning();
      
      // Invalidate cache for this manager
      this.invalidateTeamMembersCache(data.managerId);
      
      return teamMember;
    } catch (error) {
      console.error('Failed to create team member:', error);
      if (error.message.includes('already exists')) {
        throw error;
      }
      throw new Error('Failed to create team member');
    }
  }

  async updateTeamMember(id: string, data: UpdateTeamMember): Promise<TeamMember | undefined> {
    try {
      // First get the team member to check manager ID for cache invalidation
      const existingMember = await db
        .select({ managerId: teamMembers.managerId })
        .from(teamMembers)
        .where(eq(teamMembers.id, id))
        .limit(1);

      if (existingMember.length === 0) {
        return undefined;
      }

      // Check for duplicate name if name is being updated
      if (data.name) {
        const duplicateCheck = await db
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.managerId, existingMember[0].managerId),
              eq(teamMembers.name, data.name),
              sql`${teamMembers.id} != ${id}`
            )
          )
          .limit(1);

        if (duplicateCheck.length > 0) {
          throw new Error(`Team member with name "${data.name}" already exists`);
        }
      }

      const [updatedMember] = await db
        .update(teamMembers)
        .set(data)
        .where(eq(teamMembers.id, id))
        .returning();
      
      // Invalidate cache for this manager
      this.invalidateTeamMembersCache(existingMember[0].managerId);
      
      return updatedMember;
    } catch (error) {
      console.error('Failed to update team member:', error);
      if (error.message.includes('already exists')) {
        throw error;
      }
      throw new Error('Failed to update team member');
    }
  }

  async deleteTeamMember(id: string): Promise<void> {
    try {
      // First get the manager ID for cache invalidation
      const memberToDelete = await db
        .select({ managerId: teamMembers.managerId })
        .from(teamMembers)
        .where(eq(teamMembers.id, id))
        .limit(1);

      if (memberToDelete.length === 0) {
        throw new Error('Team member not found');
      }

      await db.delete(teamMembers).where(eq(teamMembers.id, id));
      
      // Invalidate cache for this manager
      this.invalidateTeamMembersCache(memberToDelete[0].managerId);
    } catch (error) {
      console.error('Failed to delete team member:', error);
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error('Failed to delete team member');
    }
  }

  // Bulk operations for better performance
  async createMultipleTeamMembers(managerId: string, membersData: Omit<InsertTeamMember, 'managerId'>[]): Promise<TeamMember[]> {
    try {
      // Prepare data with generated IDs
      const dataWithIds = membersData.map(data => ({
        ...data,
        managerId,
        id: this.generateSecureId()
      }));

      // Check for duplicate names in batch
      const names = dataWithIds.map(d => d.name);
      const existingMembers = await db
        .select({ name: teamMembers.name })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.managerId, managerId),
            inArray(teamMembers.name, names)
          )
        );

      if (existingMembers.length > 0) {
        const duplicateNames = existingMembers.map(m => m.name);
        throw new Error(`Team members with names already exist: ${duplicateNames.join(', ')}`);
      }

      // Bulk insert
      const createdMembers = await db
        .insert(teamMembers)
        .values(dataWithIds)
        .returning();
      
      // Invalidate cache for this manager
      this.invalidateTeamMembersCache(managerId);
      
      return createdMembers;
    } catch (error) {
      console.error('Failed to create multiple team members:', error);
      if (error.message.includes('already exist')) {
        throw error;
      }
      throw new Error('Failed to create team members');
    }
  }

  // Analytics queries with optimized performance
  async getTeamAnalytics(managerId: string): Promise<{
    totalMembers: number;
    strengthsDistribution: Record<string, number>;
    averageStrengthsPerMember: number;
  }> {
    try {
      // Use optimized query with aggregations
      const result = await db
        .select({
          totalMembers: count(),
          allStrengths: sql<string[]>`array_agg(unnest(${teamMembers.strengths}))`
        })
        .from(teamMembers)
        .where(eq(teamMembers.managerId, managerId));

      const { totalMembers, allStrengths } = result[0];
      
      // Process strengths distribution
      const strengthsDistribution: Record<string, number> = {};
      if (allStrengths) {
        for (const strength of allStrengths) {
          if (strength) {
            strengthsDistribution[strength] = (strengthsDistribution[strength] || 0) + 1;
          }
        }
      }

      const totalStrengths = Object.values(strengthsDistribution).reduce((sum, count) => sum + count, 0);
      const averageStrengthsPerMember = totalMembers > 0 ? totalStrengths / totalMembers : 0;

      return {
        totalMembers,
        strengthsDistribution,
        averageStrengthsPerMember
      };
    } catch (error) {
      console.error('Failed to get team analytics:', error);
      throw new Error('Failed to fetch team analytics');
    }
  }

  // Utility methods
  private generateSecureId(): string {
    return crypto.randomUUID();
  }

  // Periodic cache cleanup
  startCacheCleanup(): void {
    setInterval(() => {
      this.clearExpiredCache();
    }, 10 * 60 * 1000); // Clean up every 10 minutes
  }
}

export const storage = new DatabaseStorage();

// Start cache cleanup
storage.startCacheCleanup();