import { db } from './db';
import { 
  users, 
  teamMembers,
  conversations,
  messages,
  conversationBackups,
  emailSubscriptions,
  emailLogs,
  unsubscribeTokens,
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
  type InsertConversationBackup,
  type EmailSubscription,
  type InsertEmailSubscription,
  type UpdateEmailSubscription,
  type EmailLog,
  type InsertEmailLog,
  type UnsubscribeToken,
  type InsertUnsubscribeToken,
  type UpdateUnsubscribeToken
} from '../shared/schema';
import { eq, and, inArray, sql, count, desc, asc } from 'drizzle-orm';
import crypto from 'crypto';

const isDev = process.env.NODE_ENV === 'development';

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserOnboarding(id: string, data: UpdateUserOnboarding): Promise<User | undefined>;
  updateUserAdminStatus(id: string, isAdmin: boolean): Promise<User | undefined>;
  
  // Team member operations
  getTeamMembers(managerId: string): Promise<TeamMember[]>;
  createTeamMember(data: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, data: UpdateTeamMember): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<void>;

  // Conversation operations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string, userId: string): Promise<Conversation | undefined>;
  getConversationWithMessages(id: string, userId: string): Promise<{ conversation: Conversation; messages: Message[] } | null>;
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

  // Email operations
  getEmailSubscriptions(userId: string): Promise<EmailSubscription[]>;
  ensureEmailSubscription(userId: string, emailType: 'welcome' | 'weekly_coaching', timezone?: string): Promise<EmailSubscription>;
  updateEmailSubscription(userId: string, emailType: 'welcome' | 'weekly_coaching', data: UpdateEmailSubscription): Promise<EmailSubscription | undefined>;
  getEmailLogs(userId: string): Promise<EmailLog[]>;
  createEmailLog(data: InsertEmailLog): Promise<EmailLog>;

  // Team analytics
  getTeamAnalytics(managerId: string): Promise<{ totalMembers: number; strengthsDistribution: Record<string, number>; averageStrengthsPerMember: number }>;

  // Unsubscribe token operations
  getUnsubscribeTokens(userId: string): Promise<UnsubscribeToken[]>;
  createUnsubscribeToken(userId: string, token: string, emailType: 'welcome' | 'weekly_coaching' | 'all'): Promise<UnsubscribeToken>;
  updateUnsubscribeToken(userId: string, token: string, data: UpdateUnsubscribeToken): Promise<UnsubscribeToken | undefined>;
  deleteUnsubscribeToken(userId: string, token: string): Promise<void>;
  validateUnsubscribeToken(userId: string, token: string): Promise<boolean>;
  unsubscribeFromEmails(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Enhanced caching with LRU-like behavior
  private userCache = new Map<string, { user: User; timestamp: number }>();
  private teamMembersCache = new Map<string, { members: TeamMember[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Prevent memory leaks
  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  private getCachedUser(id: string): User | null {
    if (!id) return null;
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
    if (!id) return;
    // Implement LRU eviction
    if (this.userCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.userCache.keys().next().value;
      if (firstKey) this.userCache.delete(firstKey);
    }
    this.userCache.set(id, { user, timestamp: Date.now() });
  }

  private getCachedTeamMembers(managerId: string): TeamMember[] | null {
    if (!managerId) return null;
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
    if (!managerId) return;
    // Implement LRU eviction
    if (this.teamMembersCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.teamMembersCache.keys().next().value;
      if (firstKey) this.teamMembersCache.delete(firstKey);
    }
    this.teamMembersCache.set(managerId, { members, timestamp: Date.now() });
  }

  private invalidateTeamMembersCache(managerId: string): void {
    if (managerId) {
      this.teamMembersCache.delete(managerId);
    }
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    
    // Clear expired user cache entries
    for (const [key, value] of Array.from(this.userCache.entries())) {
      if (now - value.timestamp >= this.CACHE_TTL) {
        this.userCache.delete(key);
      }
    }
    
    // Clear expired team members cache entries
    for (const [key, value] of Array.from(this.teamMembersCache.entries())) {
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
      if (isDev) console.error('Failed to get user:', error);
      throw new Error('Failed to fetch user');
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      
      if (user) {
        this.setCachedUser(user.id, user);
      }
      
      return user;
    } catch (error) {
      if (isDev) console.error('Failed to get user by email:', error);
      throw new Error('Failed to fetch user by email');
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      // First try to find existing user
      const existingUser = await this.getUser(userData.id);
      
      if (existingUser) {
        // Update existing user
        const [user] = await db
          .update(users)
          .set({
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userData.id))
          .returning();
        
        // Update cache
        this.setCachedUser(user.id, user);
        return user;
      } else {
        // Create new user
        const [user] = await db.insert(users).values(userData).returning();
        
        // Update cache
        this.setCachedUser(user.id, user);
        return user;
      }
    } catch (error) {
      if (isDev) console.error('Failed to upsert user:', error);
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
      if (isDev) console.error('Failed to update user onboarding:', error);
      throw new Error('Failed to update user onboarding');
    }
  }

  async updateUserAdminStatus(id: string, isAdmin: boolean): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          isAdmin,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      
      if (updatedUser) {
        this.setCachedUser(id, updatedUser);
      }
      
      return updatedUser;
    } catch (error) {
      if (isDev) console.error('Failed to update user admin status:', error);
      throw new Error('Failed to update user admin status');
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
      if (isDev) console.error('Failed to get team members:', error);
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
      if (isDev) console.error('Failed to create team member:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
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
      if (isDev) console.error('Failed to update team member:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
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
      if (isDev) console.error('Failed to delete team member:', error);
      if (error instanceof Error && error.message.includes('not found')) {
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
      if (isDev) console.error('Failed to create multiple team members:', error);
      if (error instanceof Error && error.message.includes('already exist')) {
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
      if (isDev) console.error('Failed to get team analytics:', error);
      throw new Error('Failed to fetch team analytics');
    }
  }

  // Email operations
  async getEmailSubscriptions(userId: string): Promise<EmailSubscription[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const subscriptions = await db.select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.userId, userId));

      return subscriptions;
    } catch (error) {
      if (isDev) console.error('Error fetching email subscriptions:', error);
      throw new Error('Failed to fetch email subscriptions');
    }
  }

  async ensureEmailSubscription(userId: string, emailType: 'welcome' | 'weekly_coaching', timezone: string = 'America/New_York'): Promise<EmailSubscription> {
    if (!userId || !emailType) {
      throw new Error('User ID and email type are required');
    }

    try {
      // First, check if an active subscription already exists
      const existingSubscriptions = await db.select()
        .from(emailSubscriptions)
        .where(and(
          eq(emailSubscriptions.userId, userId),
          eq(emailSubscriptions.emailType, emailType),
          eq(emailSubscriptions.isActive, true)
        ));

      if (existingSubscriptions.length > 0) {
        // Return the first active subscription found
        return existingSubscriptions[0];
      }

      // Deactivate any inactive duplicates to clean up
      await db.update(emailSubscriptions)
        .set({ isActive: false })
        .where(and(
          eq(emailSubscriptions.userId, userId),
          eq(emailSubscriptions.emailType, emailType)
        ));

      // Create new subscription
      const id = this.generateSecureId();
      const [subscription] = await db.insert(emailSubscriptions)
        .values({
          id,
          userId,
          emailType,
          isActive: true,
          timezone,
          weeklyEmailCount: '0',
          startDate: new Date(),
        })
        .returning();

      return subscription;
    } catch (error) {
      if (isDev) console.error('Error ensuring email subscription:', error);
      throw new Error('Failed to ensure email subscription');
    }
  }

  async updateEmailSubscription(userId: string, emailType: 'welcome' | 'weekly_coaching', data: UpdateEmailSubscription): Promise<EmailSubscription | undefined> {
    if (!userId || !emailType) {
      throw new Error('User ID and email type are required');
    }

    try {
      const [subscription] = await db.update(emailSubscriptions)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(
          eq(emailSubscriptions.userId, userId),
          eq(emailSubscriptions.emailType, emailType)
        ))
        .returning();

      return subscription;
    } catch (error) {
      if (isDev) console.error('Error updating email subscription:', error);
      throw new Error('Failed to update email subscription');
    }
  }

  async getEmailLogs(userId: string): Promise<EmailLog[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const logs = await db.select()
        .from(emailLogs)
        .where(eq(emailLogs.userId, userId))
        .orderBy(desc(emailLogs.sentAt));

      return logs;
    } catch (error) {
      if (isDev) console.error('Error fetching email logs:', error);
      throw new Error('Failed to fetch email logs');
    }
  }

  async createEmailLog(data: InsertEmailLog): Promise<EmailLog> {
    try {
      const id = this.generateSecureId();
      const [log] = await db.insert(emailLogs)
        .values({
          id,
          ...data,
        })
        .returning();

      return log;
    } catch (error) {
      if (isDev) console.error('Error creating email log:', error);
      throw new Error('Failed to create email log');
    }
  }

  // Utility methods
  private generateSecureId(): string {
    return crypto.randomUUID();
  }

  // Periodic cache cleanup
  startCacheCleanup(): void {
    // Run cleanup every 10 minutes
    if (this.cacheCleanupInterval) return; // Prevent multiple intervals
    this.cacheCleanupInterval = setInterval(() => {
      this.clearExpiredCache();
      if (process.env.NODE_ENV === 'development') {
        console.log('[Storage] Periodic cache cleanup ran.');
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  stopCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
      if (process.env.NODE_ENV === 'development') {
        console.log('[Storage] Cache cleanup interval stopped.');
      }
    }
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
      if (isDev) console.error('Error fetching conversations:', error);
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
      if (isDev) console.error('Error fetching conversation:', error);
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
      if (isDev) console.error('Error creating conversation:', error);
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
      if (isDev) console.error('Error updating conversation:', error);
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
      if (isDev) console.error('Error deleting conversation:', error);
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
      if (isDev) console.error('Error archiving conversation:', error);
      throw new Error('Failed to archive conversation');
    }
  }

  async getConversationWithMessages(id: string, userId: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    try {
      if (isDev) console.log(`Getting conversation ${id} for user ${userId}`);
      
      const conversation = await this.getConversation(id, userId);
      if (!conversation) {
        if (isDev) console.log('Conversation not found');
        return null;
      }

      if (isDev) console.log('Found conversation, getting messages...');
      const messages = await this.getMessages(id, userId);
      if (isDev) console.log(`Found ${messages.length} messages`);
      
      return { conversation, messages };
    } catch (error) {
      if (isDev) console.error('Failed to get conversation with messages:', error);
      return null;
    }
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    if (!conversationId || !userId) {
      throw new Error('Conversation ID and User ID are required');
    }

    try {
      // Skip conversation check here since we already verified access in getConversationWithMessages
      const result = await db.select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.timestamp));

      if (isDev) console.log(`Retrieved ${result.length} messages for conversation ${conversationId}`);
      return result;
    } catch (error) {
      if (isDev) console.error('Error fetching messages:', error);
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
      if (isDev) console.error('Error creating message:', error);
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
      if (isDev) console.error('Error deleting message:', error);
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
      if (isDev) console.error('Error creating backup:', error);
      throw new Error('Failed to create backup');
    }
  }

  async getConversationBackups(userId: string): Promise<ConversationBackup[]> {
    if (!userId) {
      return [];
    }

    try {
      const result = await db.select()
        .from(conversationBackups)
        .where(eq(conversationBackups.userId, userId))
        .orderBy(desc(conversationBackups.createdAt));

      return result || [];
    } catch (error) {
      // Return empty array instead of throwing error to prevent 404 spam
      return [];
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
      if (isDev) console.error('Error restoring backup:', error);
      throw new Error('Failed to restore backup');
    }
  }

  private getCachedItem(key: string): any {
    const cached = this.teamMembersCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.members;
    }
    return null;
  }

  private setCachedItem(key: string, data: any): void {
    if (!key) return;
    if (this.teamMembersCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.teamMembersCache.keys().next().value;
      if (oldestKey) this.teamMembersCache.delete(oldestKey);
    }
    this.teamMembersCache.set(key, { members: data, timestamp: Date.now() });
  }

  private invalidateCache(key: string): void {
    this.teamMembersCache.delete(key);
  }

  // Unsubscribe token operations
  async getUnsubscribeTokens(userId: string): Promise<UnsubscribeToken[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const tokens = await db.select()
        .from(unsubscribeTokens)
        .where(eq(unsubscribeTokens.userId, userId));

      return tokens;
    } catch (error) {
      if (isDev) console.error('Error fetching unsubscribe tokens:', error);
      throw new Error('Failed to fetch unsubscribe tokens');
    }
  }

  async createUnsubscribeToken(userId: string, token: string, emailType: 'welcome' | 'weekly_coaching' | 'all'): Promise<UnsubscribeToken> {
    if (!userId || !token) {
      throw new Error('User ID and token are required');
    }

    try {
      // Set expiration to 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const [unsubscribeToken] = await db.insert(unsubscribeTokens)
        .values({
          userId,
          token,
          emailType,
          expiresAt,
        })
        .returning();

      return unsubscribeToken;
    } catch (error) {
      if (isDev) console.error('Error creating unsubscribe token:', error);
      throw new Error('Failed to create unsubscribe token');
    }
  }

  async updateUnsubscribeToken(userId: string, token: string, data: UpdateUnsubscribeToken): Promise<UnsubscribeToken | undefined> {
    if (!userId || !token) {
      throw new Error('User ID and token are required');
    }

    try {
      const [unsubscribeToken] = await db.update(unsubscribeTokens)
        .set(data)
        .where(and(
          eq(unsubscribeTokens.userId, userId),
          eq(unsubscribeTokens.token, token)
        ))
        .returning();

      return unsubscribeToken;
    } catch (error) {
      if (isDev) console.error('Error updating unsubscribe token:', error);
      throw new Error('Failed to update unsubscribe token');
    }
  }

  async deleteUnsubscribeToken(userId: string, token: string): Promise<void> {
    if (!userId || !token) {
      throw new Error('User ID and token are required');
    }

    try {
      await db.delete(unsubscribeTokens)
        .where(and(
          eq(unsubscribeTokens.userId, userId),
          eq(unsubscribeTokens.token, token)
        ));
    } catch (error) {
      if (isDev) console.error('Error deleting unsubscribe token:', error);
      throw new Error('Failed to delete unsubscribe token');
    }
  }

  async validateUnsubscribeToken(userId: string, token: string): Promise<boolean> {
    if (!userId || !token) {
      throw new Error('User ID and token are required');
    }

    try {
      const [unsubscribeToken] = await db.select()
        .from(unsubscribeTokens)
        .where(and(
          eq(unsubscribeTokens.userId, userId),
          eq(unsubscribeTokens.token, token)
        ));

      return !!unsubscribeToken;
    } catch (error) {
      if (isDev) console.error('Error validating unsubscribe token:', error);
      throw new Error('Failed to validate unsubscribe token');
    }
  }

  async unsubscribeFromEmails(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      // Delete all unsubscribe tokens for the user
      await db.delete(unsubscribeTokens)
        .where(eq(unsubscribeTokens.userId, userId));
      
      // Update email subscriptions to inactive
      await db.update(emailSubscriptions)
        .set({ isActive: false })
        .where(eq(emailSubscriptions.userId, userId));
    } catch (error) {
      if (isDev) console.error('Error unsubscribing from emails:', error);
      throw new Error('Failed to unsubscribe from emails');
    }
  }
}

export const storage = new DatabaseStorage();

// Start cache cleanup
storage.startCacheCleanup();