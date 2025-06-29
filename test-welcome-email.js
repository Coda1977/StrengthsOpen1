// Test welcome email system for debugging
import { emailService } from './server/emailService.ts';
import { db } from './server/db.ts';
import { users } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function testWelcomeEmailSystem() {
  console.log('🔍 Testing welcome email system...');
  
  try {
    // Get the user who didn't receive welcome email
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, 'codanudge@gmail.com'))
      .limit(1)
      .then(results => results[0]);

    if (!user) {
      console.error('❌ User codanudge@gmail.com not found');
      return;
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      hasCompletedOnboarding: user.hasCompletedOnboarding
    });

    // Test sending welcome email
    console.log('📧 Testing welcome email sending...');
    
    await emailService.sendWelcomeEmail(user, 'America/New_York');
    
    console.log('✅ Welcome email test completed');
    
  } catch (error) {
    console.error('❌ Welcome email test failed:', error);
    
    // Check if it's a specific error type
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')
      });
    }
  }
}

// Run the test
testWelcomeEmailSystem()
  .then(() => {
    console.log('\n📊 Welcome Email Test Complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  });