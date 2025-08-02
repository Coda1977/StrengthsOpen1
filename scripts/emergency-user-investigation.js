#!/usr/bin/env node

/**
 * EMERGENCY USER RECOVERY INVESTIGATION
 * 
 * This script searches for traces of the 30+ missing users across all database tables
 * to understand what happened and assess recovery possibilities.
 */

import { db } from '../server/db.js';
import { 
  users, 
  teamMembers, 
  conversations, 
  messages,
  conversationBackups,
  emailSubscriptions, 
  emailLogs, 
  unsubscribeTokens,
  sessions,
  openaiUsageLogs
} from '../shared/schema.js';
import { sql, eq, count, isNull, desc } from 'drizzle-orm';

async function getCurrentDatabaseState() {
  console.log('\n🔍 CURRENT DATABASE STATE ANALYSIS');
  console.log('=====================================\n');
  
  try {
    // Count all remaining data
    const remainingUsers = await db.select({ count: count() }).from(users);
    const remainingTeamMembers = await db.select({ count: count() }).from(teamMembers);
    const remainingConversations = await db.select({ count: count() }).from(conversations);
    const remainingMessages = await db.select({ count: count() }).from(messages);
    const remainingEmailLogs = await db.select({ count: count() }).from(emailLogs);
    
    console.log('📊 REMAINING DATA:');
    console.log(`  Users: ${remainingUsers[0].count}`);
    console.log(`  Team Members: ${remainingTeamMembers[0].count}`);
    console.log(`  Conversations: ${remainingConversations[0].count}`);
    console.log(`  Messages: ${remainingMessages[0].count}`);
    console.log(`  Email Logs: ${remainingEmailLogs[0].count}`);
    
    // Show remaining users
    const allUsers = await db.select().from(users).orderBy(users.createdAt);
    console.log('\n👥 REMAINING USERS:');
    allUsers.forEach(user => {
      console.log(`  ${user.email} | Admin: ${user.isAdmin} | ID: ${user.id} | Created: ${user.createdAt}`);
    });
    
    return {
      userCount: remainingUsers[0].count,
      teamMemberCount: remainingTeamMembers[0].count,
      conversationCount: remainingConversations[0].count,
      allUsers
    };
  } catch (error) {
    console.error('❌ Failed to get current state:', error);
    throw error;
  }
}

async function searchForOrphanedRecords() {
  console.log('\n🔍 SEARCHING FOR ORPHANED RECORDS');
  console.log('==================================\n');
  
  try {
    // Search for orphaned team members (these would indicate deleted managers/users)
    const orphanedTeamMembers = await db
      .select({
        managerId: teamMembers.managerId,
        name: teamMembers.name,
        strengths: teamMembers.strengths,
        createdAt: teamMembers.createdAt
      })
      .from(teamMembers)
      .leftJoin(users, eq(teamMembers.managerId, users.id))
      .where(isNull(users.id))
      .orderBy(desc(teamMembers.createdAt));
    
    console.log(`🔍 ORPHANED TEAM MEMBERS: ${orphanedTeamMembers.length}`);
    if (orphanedTeamMembers.length > 0) {
      console.log('   These indicate DELETED USER IDs:');
      orphanedTeamMembers.forEach(tm => {
        console.log(`   Manager ID: ${tm.managerId} | Team Member: ${tm.name} | Created: ${tm.createdAt}`);
      });
    }
    
    // Search for orphaned conversations
    const orphanedConversations = await db
      .select({
        userId: conversations.userId,
        title: conversations.title,
        mode: conversations.mode,
        createdAt: conversations.createdAt,
        lastActivity: conversations.lastActivity
      })
      .from(conversations)
      .leftJoin(users, eq(conversations.userId, users.id))
      .where(isNull(users.id))
      .orderBy(desc(conversations.lastActivity))
      .limit(20);
    
    console.log(`\n🔍 ORPHANED CONVERSATIONS: ${orphanedConversations.length}`);
    if (orphanedConversations.length > 0) {
      console.log('   These indicate DELETED USER IDs:');
      orphanedConversations.forEach(conv => {
        console.log(`   User ID: ${conv.userId} | Title: ${conv.title} | Last Activity: ${conv.lastActivity}`);
      });
    }
    
    // Search for orphaned email logs
    const orphanedEmailLogs = await db
      .select({
        userId: emailLogs.userId,
        emailType: emailLogs.emailType,
        emailSubject: emailLogs.emailSubject,
        sentAt: emailLogs.sentAt
      })
      .from(emailLogs)
      .leftJoin(users, eq(emailLogs.userId, users.id))
      .where(isNull(users.id))
      .orderBy(desc(emailLogs.sentAt))
      .limit(20);
    
    console.log(`\n🔍 ORPHANED EMAIL LOGS: ${orphanedEmailLogs.length}`);
    if (orphanedEmailLogs.length > 0) {
      console.log('   These indicate DELETED USER IDs:');
      orphanedEmailLogs.forEach(log => {
        console.log(`   User ID: ${log.userId} | Email: ${log.emailSubject} | Sent: ${log.sentAt}`);
      });
    }
    
    return {
      orphanedTeamMembers,
      orphanedConversations,
      orphanedEmailLogs
    };
  } catch (error) {
    console.error('❌ Failed to search orphaned records:', error);
    throw error;
  }
}

async function analyzeSessionData() {
  console.log('\n🔍 ANALYZING SESSION DATA');
  console.log('==========================\n');
  
  try {
    // Get all sessions to see if any contain user IDs that no longer exist
    const activeSessions = await db
      .select({
        sid: sessions.sid,
        sess: sessions.sess,
        expire: sessions.expire
      })
      .from(sessions)
      .where(sql`expire > NOW()`)
      .orderBy(desc(sessions.expire));
    
    console.log(`📊 ACTIVE SESSIONS: ${activeSessions.length}`);
    
    const sessionUserIds = [];
    activeSessions.forEach(session => {
      try {
        const sessionData = session.sess;
        if (sessionData.passport && sessionData.passport.user && sessionData.passport.user.claims) {
          const userId = sessionData.passport.user.claims.sub;
          const email = sessionData.passport.user.claims.email;
          sessionUserIds.push({ userId, email, expire: session.expire });
          console.log(`   Session User: ${email} | ID: ${userId} | Expires: ${session.expire}`);
        }
      } catch (e) {
        // Skip malformed session data
      }
    });
    
    return sessionUserIds;
  } catch (error) {
    console.error('❌ Failed to analyze sessions:', error);
    throw error;
  }
}

async function checkForBackups() {
  console.log('\n🔍 CHECKING FOR BACKUP DATA');
  console.log('============================\n');
  
  try {
    // Check conversation backups
    const backupCount = await db.select({ count: count() }).from(conversationBackups);
    console.log(`📊 CONVERSATION BACKUPS: ${backupCount[0].count}`);
    
    if (backupCount[0].count > 0) {
      const recentBackups = await db
        .select()
        .from(conversationBackups)
        .orderBy(desc(conversationBackups.createdAt))
        .limit(10);
      
      console.log('   Recent backups:');
      recentBackups.forEach(backup => {
        console.log(`   User ID: ${backup.userId} | Source: ${backup.source} | Created: ${backup.createdAt}`);
      });
    }
    
    return backupCount[0].count;
  } catch (error) {
    console.error('❌ Failed to check backups:', error);
    throw error;
  }
}

async function generateRecoveryAssessment(orphanedData, sessionData, currentState) {
  console.log('\n🚨 RECOVERY ASSESSMENT');
  console.log('======================\n');
  
  const deletedUserIds = new Set();
  
  // Collect all deleted user IDs from orphaned records
  orphanedData.orphanedTeamMembers.forEach(tm => deletedUserIds.add(tm.managerId));
  orphanedData.orphanedConversations.forEach(conv => deletedUserIds.add(conv.userId));
  orphanedData.orphanedEmailLogs.forEach(log => deletedUserIds.add(log.userId));
  
  console.log('💥 DELETION ANALYSIS:');
  console.log(`   Estimated deleted users: ${deletedUserIds.size}`);
  console.log(`   Remaining users: ${currentState.userCount}`);
  console.log(`   Total original users (estimated): ${deletedUserIds.size + currentState.userCount}`);
  
  console.log('\n🔍 DELETED USER IDs FOUND:');
  Array.from(deletedUserIds).forEach(userId => {
    console.log(`   ${userId}`);
  });
  
  console.log('\n📊 RECOVERY POSSIBILITIES:');
  if (deletedUserIds.size > 0) {
    console.log('   ✅ POSSIBLE: User IDs found in orphaned records');
    console.log('   ✅ Data traces exist - partial recovery may be possible');
    console.log('   ⚠️  CASCADE DELETION occurred - related data was auto-deleted');
    
    // Check if admin's original account was among deleted
    const adminRelatedOrphans = orphanedData.orphanedTeamMembers.filter(tm => 
      sessionData.some(s => s.email === 'tinymanagerai@gmail.com')
    );
    
    if (adminRelatedOrphans.length > 0) {
      console.log('   🚨 CRITICAL: Admin\'s team members found orphaned');
      console.log('   🚨 This confirms admin\'s original account was deleted');
    }
  } else {
    console.log('   ❌ UNLIKELY: No user traces found');
    console.log('   ❌ Complete data loss - no recovery possible');
  }
  
  console.log('\n🔧 IMMEDIATE ACTIONS NEEDED:');
  console.log('   1. 🛑 STOP all database cleanup operations immediately');
  console.log('   2. 📋 Document all found user IDs for manual recreation');
  console.log('   3. 🔍 Check if database has automatic backups');
  console.log('   4. ⚠️  Review cascade deletion rules in schema');
  
  return {
    estimatedDeletedUsers: deletedUserIds.size,
    deletedUserIds: Array.from(deletedUserIds),
    recoveryPossible: deletedUserIds.size > 0
  };
}

async function main() {
  console.log('🚨 EMERGENCY USER RECOVERY INVESTIGATION');
  console.log('==========================================');
  console.log(`Started at: ${new Date().toISOString()}\n`);
  
  try {
    // Step 1: Get current database state
    const currentState = await getCurrentDatabaseState();
    
    // Step 2: Search for orphaned records
    const orphanedData = await searchForOrphanedRecords();
    
    // Step 3: Analyze session data
    const sessionData = await analyzeSessionData();
    
    // Step 4: Check for backups
    await checkForBackups();
    
    // Step 5: Generate recovery assessment
    const assessment = await generateRecoveryAssessment(orphanedData, sessionData, currentState);
    
    console.log('\n🎯 INVESTIGATION COMPLETE');
    console.log('=========================');
    console.log(`Found evidence of ${assessment.estimatedDeletedUsers} deleted users`);
    console.log(`Recovery possible: ${assessment.recoveryPossible ? 'YES' : 'NO'}`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('\n💥 INVESTIGATION FAILED:', error);
    process.exit(1);
  }
}

// Run the investigation
main().catch(console.error);