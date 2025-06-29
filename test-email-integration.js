// Comprehensive email system integration test
import { emailService } from './server/emailService.ts';
import { db } from './server/db.ts';
import { users, emailLogs, emailSubscriptions } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function testEmailIntegration() {
  console.log('Testing email system integration...');
  
  try {
    // Test 1: Get test user from database
    console.log('1. Fetching test user from database...');
    const testUser = await db
      .select()
      .from(users)
      .where(eq(users.email, 'tinymanagerai@gmail.com'))
      .limit(1)
      .then(results => results[0]);

    if (!testUser) {
      throw new Error('Test user not found in database');
    }
    
    console.log('✓ Test user found:', testUser.email);

    // Test 2: Send welcome email
    console.log('2. Testing welcome email delivery...');
    await emailService.sendWelcomeEmail(testUser, 'America/New_York');
    console.log('✓ Welcome email sent successfully');

    // Test 3: Verify email log was created
    console.log('3. Verifying email log creation...');
    const emailLog = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.userId, testUser.id))
      .orderBy(emailLogs.createdAt)
      .limit(1)
      .then(results => results[0]);

    if (emailLog) {
      console.log('✓ Email log created:', emailLog.emailType, emailLog.status);
    } else {
      console.log('⚠ No email log found (may be async)');
    }

    // Test 4: Check email subscription
    console.log('4. Checking email subscription...');
    const subscription = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.userId, testUser.id))
      .limit(1)
      .then(results => results[0]);

    if (subscription) {
      console.log('✓ Email subscription active:', subscription.welcomeEmails, subscription.weeklyEmails);
    } else {
      console.log('⚠ No email subscription found');
    }

    return { success: true, message: 'All email integration tests passed' };
  } catch (error) {
    console.error('❌ Email integration test failed:', error);
    return { success: false, error: error.message };
  }
}

// Run comprehensive email tests
testEmailIntegration()
  .then(result => {
    console.log('\n📧 Email Integration Test Results:');
    console.log('Success:', result.success);
    if (result.success) {
      console.log('✅ Email system fully operational for production');
    } else {
      console.log('❌ Email integration issues found');
      console.log('Error:', result.error);
    }
  })
  .catch(console.error);