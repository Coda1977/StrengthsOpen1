import { db } from './db';
import { 
  users, 
  teamMembers,
  conversations,
  messages,
  conversationBackups,
  type User, 
  type UpsertUser, 
  type UpdateUserOnboarding, 
  type TeamMember, 
  type InsertTeamMember, 
  type UpdateTeamMember,
  type Conversation,
  type InsertConversation,
  type UpdateConversation,
  type Message,
  type InsertMessage,
  type ConversationBackup,
  type InsertConversationBackup
} from '../shared/schema';
import { eq, and, inArray, sql, count, desc, asc } from 'drizzle-orm';
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

  // Conversation operations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string, userId: string): Promise<Conversation | undefined>;
  createConversation(userId: string, data: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, userId: string, data: UpdateConversation): Promise<Conversation | undefined>;
  deleteConversation(id: string, userId: string): Promise<void>;
  archiveConversation(id: string, userId: string): Promise<void>;

  // Message operations
  getMessages(conversationId: string, userId: string): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  deleteMessage(id: string, userId: string): Promise<void>;

  // Backup operations
  createConversationBackup(userId: string, data: InsertConversationBackup): Promise<ConversationBackup>;
  getConversationBackups(userId: string): Promise<ConversationBackup[]>;
  restoreConversationBackup(backupId: string, userId: string): Promise<Conversation[]>;
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
      if ((error as Error).message.includes('already exists')) {
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

  // Conversation operations
  async getConversations(userId: string): Promise<Conversation[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const cacheKey = `conversations:${userId}`;
    const cached = this.getCachedItem(cacheKey);
    if (cached) return cached;

    try {
      const result = await db.select()
        .from(conversations)
        .where(and(
          eq(conversations.userId, userId),
          eq(conversations.isArchived, false)
        ))
        .orderBy(desc(conversations.lastActivity));

      this.setCachedItem(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw new Error('Failed to fetch conversations');
    }
  }

  async getConversation(id: string, userId: string): Promise<Conversation | undefined> {
    if (!id || !userId) {
      throw new Error('Conversation ID and User ID are required');
    }

    try {
      const [conversation] = await db.select()
        .from(conversations)
        .where(and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        ));
      return conversation;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw new Error('Failed to fetch conversation');
    }
  }

  async createConversation(userId: string, data: InsertConversation): Promise<Conversation> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const id = this.generateSecureId();
      const [conversation] = await db.insert(conversations)
        .values({
          id,
          userId,
          ...data,
        })
        .returning();

      this.invalidateCache(`conversations:${userId}`);
      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  async updateConversation(id: string, userId: string, data: UpdateConversation): Promise<Conversation | undefined> {
    if (!id || !userId) {
      throw new Error('Conversation ID and User ID are required');
    }

    try {
      const [conversation] = await db.update(conversations)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        ))
        .returning();

      this.invalidateCache(`conversations:${userId}`);
      return conversation;
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw new Error('Failed to update conversation');
    }
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    if (!id || !userId) {
      throw new Error('Conversation ID and User ID are required');
    }

    try {
      await db.delete(conversations)
        .where(and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        ));

      this.invalidateCache(`conversations:${userId}`);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw new Error('Failed to delete conversation');
    }
  }

  async archiveConversation(id: string, userId: string): Promise<void> {
    if (!id || !userId) {
      throw new Error('Conversation ID and User ID are required');
    }

    try {
      await db.update(conversations)
        .set({
          isArchived: true,
          updatedAt: new Date(),
        })
        .where(and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        ));

      this.invalidateCache(`conversations:${userId}`);
    } catch (error) {
      console.error('Error archiving conversation:', error);
      throw new Error('Failed to archive conversation');
    }
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    if (!conversationId || !userId) {
      throw new Error('Conversation ID and User ID are required');
    }

    try {
      const conversation = await this.getConversation(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      const result = await db.select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.timestamp));

      return result;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw new Error('Failed to fetch messages');
    }
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    if (!data.conversationId || !data.content || !data.type) {
      throw new Error('Conversation ID, content, and type are required');
    }

    try {
      const id = this.generateSecureId();
      const [message] = await db.insert(messages)
        .values({
          id,
          ...data,
        })
        .returning();

      await db.update(conversations)
        .set({
          lastActivity: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, data.conversationId));

      return message;
    } catch (error) {
      console.error('Error creating message:', error);
      throw new Error('Failed to create message');
    }
  }

  async deleteMessage(id: string, userId: string): Promise<void> {
    if (!id || !userId) {
      throw new Error('Message ID and User ID are required');
    }

    try {
      const [message] = await db.select()
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(and(
          eq(messages.id, id),
          eq(conversations.userId, userId)
        ));

      if (!message) {
        throw new Error('Message not found or access denied');
      }

      await db.delete(messages).where(eq(messages.id, id));
    } catch (error) {
      console.error('Error deleting message:', error);
      throw new Error('Failed to delete message');
    }
  }

  async createConversationBackup(userId: string, data: InsertConversationBackup): Promise<ConversationBackup> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const id = this.generateSecureId();
      const [backup] = await db.insert(conversationBackups)
        .values({
          id,
          userId,
          ...data,
        })
        .returning();

      return backup;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw new Error('Failed to create backup');
    }
  }

  async getConversationBackups(userId: string): Promise<ConversationBackup[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const result = await db.select()
        .from(conversationBackups)
        .where(eq(conversationBackups.userId, userId))
        .orderBy(desc(conversationBackups.createdAt));

      return result;
    } catch (error) {
      console.error('Error fetching backups:', error);
      throw new Error('Failed to fetch backups');
    }
  }

  async restoreConversationBackup(backupId: string, userId: string): Promise<Conversation[]> {
    if (!backupId || !userId) {
      throw new Error('Backup ID and User ID are required');
    }

    try {
      const [backup] = await db.select()
        .from(conversationBackups)
        .where(and(
          eq(conversationBackups.id, backupId),
          eq(conversationBackups.userId, userId)
        ));

      if (!backup) {
        throw new Error('Backup not found or access denied');
      }

      const backupData = backup.backupData as any[];
      const restoredConversations: Conversation[] = [];

      for (const conversationData of backupData) {
        const conversation = await this.createConversation(userId, {
          title: conversationData.title + ' (Restored)',
          mode: conversationData.mode || 'personal',
          metadata: { restoredFrom: backupId, originalId: conversationData.id }
        });

        if (conversationData.messages && Array.isArray(conversationData.messages)) {
          for (const messageData of conversationData.messages) {
            await this.createMessage({
              conversationId: conversation.id,
              content: messageData.content,
              type: messageData.type,
              metadata: { originalTimestamp: messageData.timestamp }
            });
          }
        }

        restoredConversations.push(conversation);
      }

      await db.update(conversationBackups)
        .set({ restoredAt: new Date() })
        .where(eq(conversationBackups.id, backupId));

      this.invalidateCache(`conversations:${userId}`);
      return restoredConversations;
    } catch (error) {
      console.error('Error restoring backup:', error);
      throw new Error('Failed to restore backup');
    }
  }

  private getCachedItem(key: string): any {
    const cached = this.teamMembersCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedItem(key: string, data: any): void {
    if (this.teamMembersCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.teamMembersCache.keys().next().value;
      this.teamMembersCache.delete(oldestKey);
    }
    this.teamMembersCache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateCache(key: string): void {
    this.teamMembersCache.delete(key);
  }
}

export const storage = new DatabaseStorage();

// Start cache cleanup
storage.startCacheCleanup();