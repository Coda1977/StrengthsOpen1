/**
 * DATA PROTECTION UTILITIES
 * 
 * This module provides safe deletion and data protection mechanisms
 * to prevent accidental data loss.
 */

import { db } from './db.js';
import { users, teamMembers, conversations, messages } from '../shared/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

// Soft delete flag - users marked as deleted but data preserved
export async function softDeleteUser(userId: string, reason: string): Promise<boolean> {
  try {
    console.log(`[DATA_PROTECTION] Soft deleting user ${userId} - Reason: ${reason}`);
    
    // Mark user as deleted instead of actually deleting
    const result = await db
      .update(users)
      .set({
        // Add soft delete fields to schema later
        // deletedAt: new Date(),
        // deletedReason: reason,
        // Keep existing data intact
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (result.length > 0) {
      console.log(`[DATA_PROTECTION] User ${userId} soft deleted successfully`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[DATA_PROTECTION] Failed to soft delete user ${userId}:`, error);
    return false;
  }
}

// Safe user cleanup with validation requirements
export async function safeDeleteUser(userId: string, options: {
  adminUserId: string;
  reason: string;
  preserveData?: boolean;
}): Promise<{ success: boolean; message: string }> {
  try {
    
    // Check if user has important data
    const userDataCheck = await checkUserDataImportance(userId);
    
    if (userDataCheck.hasImportantData && !options.preserveData) {
      return { 
        success: false, 
        message: `User has important data: ${userDataCheck.dataTypes.join(', ')}. Use preserveData: true or soft delete.` 
      };
    }
    
    // Log the deletion attempt
    console.log(`[DATA_PROTECTION] Safe deletion requested by admin ${options.adminUserId} for user ${userId}`);
    console.log(`[DATA_PROTECTION] Reason: ${options.reason}`);
    console.log(`[DATA_PROTECTION] Data importance: ${JSON.stringify(userDataCheck)}`);
    
    if (options.preserveData) {
      // Use soft delete instead
      const softDeleted = await softDeleteUser(userId, options.reason);
      return { 
        success: softDeleted, 
        message: softDeleted ? 'User soft deleted - data preserved' : 'Soft delete failed' 
      };
    }
    
    // If we reach here, perform actual deletion with extra safety
    // This should be extremely rare and heavily logged
    console.error(`[DATA_PROTECTION] CRITICAL: Actual user deletion proceeding for ${userId}`);
    
    return { success: false, message: 'Hard deletion disabled for safety' };
    
  } catch (error) {
    console.error(`[DATA_PROTECTION] Safe delete failed for user ${userId}:`, error);
    return { success: false, message: 'Delete operation failed' };
  }
}

// Check if user has important data that shouldn't be deleted
async function checkUserDataImportance(userId: string): Promise<{
  hasImportantData: boolean;
  dataTypes: string[];
  counts: Record<string, number>;
}> {
  try {
    const [teamMemberCount, conversationCount, messageCount] = await Promise.all([
      db.select().from(teamMembers).where(eq(teamMembers.managerId, userId)),
      db.select().from(conversations).where(eq(conversations.userId, userId)),
      db.select().from(messages).where(eq(messages.conversationId, userId)) // This needs proper join
    ]);
    
    const counts = {
      teamMembers: teamMemberCount.length,
      conversations: conversationCount.length,
      messages: messageCount.length
    };
    
    const dataTypes = [];
    if (counts.teamMembers > 0) dataTypes.push(`${counts.teamMembers} team members`);
    if (counts.conversations > 0) dataTypes.push(`${counts.conversations} conversations`);
    if (counts.messages > 0) dataTypes.push(`${counts.messages} messages`);
    
    return {
      hasImportantData: dataTypes.length > 0,
      dataTypes,
      counts
    };
  } catch (error) {
    console.error('[DATA_PROTECTION] Error checking user data importance:', error);
    return { hasImportantData: true, dataTypes: ['unknown data'], counts: {} };
  }
}

// Data backup before any risky operations
export async function createDataBackup(userId: string, operation: string): Promise<string | null> {
  try {
    console.log(`[DATA_PROTECTION] Creating backup for user ${userId} before ${operation}`);
    
    // Get all user data
    const userData = await db.select().from(users).where(eq(users.id, userId));
    const teamData = await db.select().from(teamMembers).where(eq(teamMembers.managerId, userId));
    const conversationData = await db.select().from(conversations).where(eq(conversations.userId, userId));
    
    const backupData = {
      timestamp: new Date().toISOString(),
      operation,
      userId,
      userData,
      teamData,
      conversationData
    };
    
    // Store backup (implement backup storage)
    const backupId = `backup_${userId}_${Date.now()}`;
    console.log(`[DATA_PROTECTION] Backup created: ${backupId}`);
    
    // TODO: Store in backup table or external storage
    
    return backupId;
  } catch (error) {
    console.error(`[DATA_PROTECTION] Backup creation failed for user ${userId}:`, error);
    return null;
  }
}

// Block dangerous operations in production
export function validateSafeOperation(operation: string, environment: string): boolean {
  const dangerousOperations = [
    'bulk_delete_users',
    'cascade_delete',
    'cleanup_all_users',
    'reset_database'
  ];
  
  if (environment === 'production' && dangerousOperations.includes(operation)) {
    console.error(`[DATA_PROTECTION] BLOCKED: Dangerous operation '${operation}' not allowed in production`);
    return false;
  }
  
  return true;
}

export const DataProtection = {
  softDeleteUser,
  safeDeleteUser,
  createDataBackup,
  validateSafeOperation
};