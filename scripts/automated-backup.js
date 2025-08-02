#!/usr/bin/env node

/**
 * AUTOMATED DATABASE BACKUP SYSTEM
 * 
 * This script creates regular backups of critical user data
 * to prevent data loss in case of system issues.
 */

import { db } from '../server/db.js';
import { 
  users, 
  teamMembers, 
  conversations, 
  messages,
  emailSubscriptions,
  emailLogs
} from '../shared/schema.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function createFullBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(process.cwd(), 'backups');
  
  try {
    console.log(`[BACKUP] Starting full database backup at ${timestamp}`);
    
    // Ensure backup directory exists
    try {
      const fs = await import('fs');
      await fs.promises.mkdir(backupDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
    
    // Get all critical data
    const [
      allUsers,
      allTeamMembers,
      allConversations,
      allMessages,
      allEmailSubscriptions,
      allEmailLogs
    ] = await Promise.all([
      db.select().from(users),
      db.select().from(teamMembers),
      db.select().from(conversations),
      db.select().from(messages),
      db.select().from(emailSubscriptions),
      db.select().from(emailLogs)
    ]);
    
    const backup = {
      timestamp,
      version: '1.0',
      counts: {
        users: allUsers.length,
        teamMembers: allTeamMembers.length,
        conversations: allConversations.length,
        messages: allMessages.length,
        emailSubscriptions: allEmailSubscriptions.length,
        emailLogs: allEmailLogs.length
      },
      data: {
        users: allUsers,
        teamMembers: allTeamMembers,
        conversations: allConversations,
        messages: allMessages,
        emailSubscriptions: allEmailSubscriptions,
        emailLogs: allEmailLogs
      }
    };
    
    // Write backup file
    const backupFilename = `backup-${timestamp}.json`;
    const backupPath = join(backupDir, backupFilename);
    
    writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log(`[BACKUP] ✅ Full backup completed: ${backupFilename}`);
    console.log(`[BACKUP] 📊 Data backed up:`, backup.counts);
    console.log(`[BACKUP] 📁 Location: ${backupPath}`);
    
    // Create summary file for quick reference
    const summaryPath = join(backupDir, 'latest-backup.json');
    writeFileSync(summaryPath, JSON.stringify({
      latest: backupFilename,
      timestamp,
      counts: backup.counts,
      path: backupPath
    }, null, 2));
    
    return backupPath;
    
  } catch (error) {
    console.error('[BACKUP] ❌ Backup failed:', error);
    throw error;
  }
}

async function createIncrementalBackup() {
  console.log('[BACKUP] Creating incremental backup...');
  
  // Get data modified in last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  try {
    const recentUsers = await db
      .select()
      .from(users)
      .where(sql`updated_at > ${yesterday}`);
    
    const recentConversations = await db
      .select()
      .from(conversations)
      .where(sql`last_activity > ${yesterday}`);
    
    console.log(`[BACKUP] 📊 Recent changes: ${recentUsers.length} users, ${recentConversations.length} conversations`);
    
    if (recentUsers.length === 0 && recentConversations.length === 0) {
      console.log('[BACKUP] ✅ No recent changes - incremental backup skipped');
      return null;
    }
    
    // Create incremental backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const incrementalBackup = {
      type: 'incremental',
      timestamp,
      since: yesterday.toISOString(),
      data: {
        users: recentUsers,
        conversations: recentConversations
      }
    };
    
    const backupDir = join(process.cwd(), 'backups', 'incremental');
    try {
      const fs = await import('fs');
      await fs.promises.mkdir(backupDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
    
    const backupPath = join(backupDir, `incremental-${timestamp}.json`);
    writeFileSync(backupPath, JSON.stringify(incrementalBackup, null, 2));
    
    console.log(`[BACKUP] ✅ Incremental backup completed: ${backupPath}`);
    return backupPath;
    
  } catch (error) {
    console.error('[BACKUP] ❌ Incremental backup failed:', error);
    throw error;
  }
}

async function cleanupOldBackups() {
  console.log('[BACKUP] Cleaning up old backups...');
  
  try {
    const fs = await import('fs');
    const backupDir = join(process.cwd(), 'backups');
    
    const files = await fs.promises.readdir(backupDir);
    const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.json'));
    
    // Keep last 30 backups
    if (backupFiles.length > 30) {
      const sortedFiles = backupFiles.sort().reverse();
      const filesToDelete = sortedFiles.slice(30);
      
      for (const file of filesToDelete) {
        await fs.promises.unlink(join(backupDir, file));
        console.log(`[BACKUP] 🗑️  Deleted old backup: ${file}`);
      }
    }
    
    console.log(`[BACKUP] ✅ Cleanup completed - ${backupFiles.length} backups retained`);
    
  } catch (error) {
    console.error('[BACKUP] ⚠️  Cleanup failed:', error);
    // Don't throw - cleanup failure shouldn't break backup process
  }
}

async function main() {
  const command = process.argv[2] || 'full';
  
  console.log(`[BACKUP] Starting ${command} backup process...`);
  
  try {
    switch (command) {
      case 'full':
        await createFullBackup();
        break;
      case 'incremental':
        await createIncrementalBackup();
        break;
      case 'cleanup':
        await cleanupOldBackups();
        break;
      default:
        console.log('[BACKUP] Usage: npm run backup [full|incremental|cleanup]');
        process.exit(1);
    }
    
    console.log('[BACKUP] 🎉 Backup process completed successfully');
    
  } catch (error) {
    console.error('[BACKUP] 💥 Backup process failed:', error);
    process.exit(1);
  }
}

// Run backup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}