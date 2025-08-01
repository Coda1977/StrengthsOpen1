#!/usr/bin/env node

/**
 * Database Admin Fix and Analysis Script
 * 
 * This script will:
 * 1. Analyze current database state
 * 2. Fix admin flag for tinymanagerai@gmail.com
 * 3. Clean up duplicate admin accounts
 * 4. Verify database integrity
 * 5. Generate comprehensive report
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, teamMembers, conversations, emailLogs, emailSubscriptions, sessions } from '../shared/schema.js';
import { eq, count, sql, isNull, and } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/postgres';
const client = postgres(connectionString);
const db = drizzle(client);

async function analyzeDatabase() {
  console.log('\n🔍 ANALYZING DATABASE STATE...\n');
  
  try {
    // 1. Get all users
    const allUsers = await db.select().from(users).orderBy(users.createdAt);
    console.log('📊 USER ANALYSIS:');
    console.log(`Total Users: ${allUsers.length}`);
    
    const adminUsers = allUsers.filter(u => u.isAdmin);
    const onboardedUsers = allUsers.filter(u => u.hasCompletedOnboarding);
    
    console.log(`Admin Users: ${adminUsers.length}`);
    console.log(`Onboarded Users: ${onboardedUsers.length}`);
    
    // Show all users
    console.log('\n👥 ALL USERS:');
    allUsers.forEach(user => {
      console.log(`  ${user.email} | Admin: ${user.isAdmin} | Onboarded: ${user.hasCompletedOnboarding} | ID: ${user.id}`);
    });
    
    // 2. Check for duplicates
    const emailCounts = {};
    allUsers.forEach(user => {
      if (user.email) {
        emailCounts[user.email] = (emailCounts[user.email] || 0) + 1;
      }
    });
    
    const duplicates = Object.entries(emailCounts).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('\n⚠️  DUPLICATE EMAILS FOUND:');
      duplicates.forEach(([email, count]) => {
        console.log(`  ${email}: ${count} accounts`);
      });
    }
    
    // 3. Check team member distribution
    const teamMembersData = await db
      .select({
        managerEmail: users.email,
        managerName: users.firstName,
        isAdmin: users.isAdmin,
        teamMemberCount: count(teamMembers.id)
      })
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.managerId))
      .groupBy(users.id, users.email, users.firstName, users.isAdmin);
    
    console.log('\n👥 TEAM STRUCTURE:');
    teamMembersData
      .sort((a, b) => b.teamMemberCount - a.teamMemberCount)
      .forEach(manager => {
        if (manager.teamMemberCount > 0) {
          console.log(`  ${manager.managerEmail}: ${manager.teamMemberCount} team members`);
        }
      });
    
    return { allUsers, adminUsers, duplicates };
  } catch (error) {
    console.error('❌ Database analysis failed:', error);
    throw error;
  }
}

async function checkDatabaseIntegrity() {
  console.log('\n🔍 CHECKING DATABASE INTEGRITY...\n');
  
  try {
    // Check for orphaned records
    const orphanedTeamMembers = await db
      .select({ count: count() })
      .from(teamMembers)
      .leftJoin(users, eq(teamMembers.managerId, users.id))
      .where(isNull(users.id));
    
    const orphanedConversations = await db
      .select({ count: count() })
      .from(conversations)
      .leftJoin(users, eq(conversations.userId, users.id))
      .where(isNull(users.id));
    
    const orphanedEmailLogs = await db
      .select({ count: count() })
      .from(emailLogs)
      .leftJoin(users, eq(emailLogs.userId, users.id))
      .where(isNull(users.id));
    
    console.log('🔍 INTEGRITY CHECK RESULTS:');
    console.log(`  Orphaned Team Members: ${orphanedTeamMembers[0]?.count || 0}`);
    console.log(`  Orphaned Conversations: ${orphanedConversations[0]?.count || 0}`);
    console.log(`  Orphaned Email Logs: ${orphanedEmailLogs[0]?.count || 0}`);
    
    return {
      orphanedTeamMembers: orphanedTeamMembers[0]?.count || 0,
      orphanedConversations: orphanedConversations[0]?.count || 0,
      orphanedEmailLogs: orphanedEmailLogs[0]?.count || 0
    };
  } catch (error) {
    console.error('❌ Integrity check failed:', error);
    throw error;
  }
}

async function fixAdminAccount() {
  console.log('\n🔧 FIXING ADMIN ACCOUNT...\n');
  
  try {
    // 1. Check current admin status
    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.email, 'tinymanagerai@gmail.com'))
      .limit(1);
    
    if (targetUser.length === 0) {
      console.log('❌ Target admin user not found: tinymanagerai@gmail.com');
      return false;
    }
    
    const user = targetUser[0];
    console.log('📋 BEFORE FIX:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Admin Status: ${user.isAdmin}`);
    console.log(`  User ID: ${user.id}`);
    
    // 2. Set admin flag
    const updatedUsers = await db
      .update(users)
      .set({
        isAdmin: true,
        updatedAt: new Date()
      })
      .where(eq(users.email, 'tinymanagerai@gmail.com'))
      .returning();
    
    if (updatedUsers.length > 0) {
      console.log('✅ AFTER FIX:');
      console.log(`  Email: ${updatedUsers[0].email}`);
      console.log(`  Admin Status: ${updatedUsers[0].isAdmin}`);
      console.log(`  Updated At: ${updatedUsers[0].updatedAt}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Admin fix failed:', error);
    throw error;
  }
}

async function cleanupDuplicateAdminAccounts() {
  console.log('\n🧹 CLEANING UP DUPLICATE ADMIN ACCOUNTS...\n');
  
  try {
    // 1. Show all admin accounts before cleanup
    const allAdminsBefore = await db
      .select()
      .from(users)
      .where(eq(users.isAdmin, true));
    
    console.log('📋 ADMIN ACCOUNTS BEFORE CLEANUP:');
    allAdminsBefore.forEach(admin => {
      console.log(`  ${admin.email} | ID: ${admin.id} | Created: ${admin.createdAt}`);
    });
    
    // 2. Remove duplicate codanudge admin account if tinymanagerai is now admin
    const targetAdminExists = allAdminsBefore.some(u => u.email === 'tinymanagerai@gmail.com');
    
    if (targetAdminExists) {
      const duplicateAdmin = allAdminsBefore.find(u => u.email === 'codanudge@gmail.com');
      
      if (duplicateAdmin) {
        console.log(`\n🗑️  Removing duplicate admin account: ${duplicateAdmin.email}`);
        
        await db
          .delete(users)
          .where(and(
            eq(users.email, 'codanudge@gmail.com'),
            eq(users.isAdmin, true)
          ));
        
        console.log('✅ Duplicate admin account removed');
      }
    }
    
    // 3. Show final admin accounts
    const allAdminsAfter = await db
      .select()
      .from(users)
      .where(eq(users.isAdmin, true));
    
    console.log('\n📋 ADMIN ACCOUNTS AFTER CLEANUP:');
    allAdminsAfter.forEach(admin => {
      console.log(`  ${admin.email} | ID: ${admin.id} | Created: ${admin.createdAt}`);
    });
    
    return allAdminsAfter;
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

async function generateReport() {
  console.log('\n📊 GENERATING FINAL REPORT...\n');
  
  try {
    const finalUsers = await db.select().from(users);
    const adminCount = finalUsers.filter(u => u.isAdmin).length;
    const onboardedCount = finalUsers.filter(u => u.hasCompletedOnboarding).length;
    
    console.log('🎯 FINAL SUMMARY:');
    console.log(`  Total Users: ${finalUsers.length}`);
    console.log(`  Admin Users: ${adminCount}`);
    console.log(`  Onboarded Users: ${onboardedCount}`);
    console.log(`  Timestamp: ${new Date().toISOString()}`);
    
    // Verify admin access should work
    const adminUser = finalUsers.find(u => u.email === 'tinymanagerai@gmail.com');
    if (adminUser && adminUser.isAdmin) {
      console.log('\n✅ ADMIN ACCESS VERIFICATION:');
      console.log(`  ✅ User exists: ${adminUser.email}`);
      console.log(`  ✅ Admin flag set: ${adminUser.isAdmin}`);
      console.log(`  ✅ Admin dashboard should now work!`);
    } else {
      console.log('\n❌ ADMIN ACCESS VERIFICATION FAILED');
    }
    
    return {
      totalUsers: finalUsers.length,
      adminUsers: adminCount,
      onboardedUsers: onboardedCount,
      adminAccessFixed: adminUser && adminUser.isAdmin
    };
  } catch (error) {
    console.error('❌ Report generation failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 STARTING DATABASE ADMIN FIX AND ANALYSIS...\n');
  
  try {
    // Step 1: Analyze current state
    await analyzeDatabase();
    
    // Step 2: Check integrity
    await checkDatabaseIntegrity();
    
    // Step 3: Fix admin account
    const adminFixed = await fixAdminAccount();
    
    if (adminFixed) {
      // Step 4: Clean up duplicates
      await cleanupDuplicateAdminAccounts();
      
      // Step 5: Generate final report
      const report = await generateReport();
      
      if (report.adminAccessFixed) {
        console.log('\n🎉 SUCCESS! Admin access has been fixed.');
        console.log('   You should now be able to access admin dashboard and see all users.');
      } else {
        console.log('\n❌ Admin fix may have failed. Please check manually.');
      }
    } else {
      console.log('\n❌ Could not fix admin account. Please check database connection.');
    }
    
  } catch (error) {
    console.error('\n💥 SCRIPT FAILED:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the script
main().catch(console.error);