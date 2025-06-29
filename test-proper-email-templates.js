import { emailService } from './server/emailService.js';
import { storage } from './server/storage.js';

async function testProperEmailTemplates() {
  console.log('='.repeat(60));
  console.log('TESTING PROPER EMAIL TEMPLATES WITH AI CONTENT');
  console.log('='.repeat(60));
  
  try {
    // Get the test user (codanudge)
    const testUser = await storage.getUserByEmail('codanudge@gmail.com');
    
    if (!testUser) {
      console.error('Test user not found. Please ensure codanudge@gmail.com user exists.');
      return;
    }
    
    console.log('✅ Found test user:', testUser.firstName || testUser.email);
    console.log('User strengths:', testUser.topStrengths?.join(', ') || 'None set');
    
    // Test 1: Welcome Email with React Template
    console.log('\n📧 Testing Welcome Email with React Template...');
    try {
      await emailService.sendWelcomeEmail(testUser);
      console.log('✅ Welcome email sent successfully!');
    } catch (error) {
      console.error('❌ Welcome email failed:', error.message);
    }
    
    // Test 2: Weekly Coaching Email with React Template
    console.log('\n📧 Testing Weekly Coaching Email with React Template...');
    try {
      await emailService.sendWeeklyCoachingEmail(testUser, 1);
      console.log('✅ Weekly coaching email sent successfully!');
    } catch (error) {
      console.error('❌ Weekly coaching email failed:', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('EMAIL TEMPLATE TEST COMPLETED');
    console.log('='.repeat(60));
    console.log('Check your email inbox to see the properly formatted emails');
    console.log('with AI-generated content and beautiful React templates!');
    
  } catch (error) {
    console.error('💥 Critical error during email template testing:', error);
  }
}

testProperEmailTemplates();