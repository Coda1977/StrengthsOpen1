import { emailService } from './server/emailService.js';

async function testWeeklyEmailDebug() {
  console.log('Testing weekly email system...');
  
  try {
    // Test with a mock user that matches codanudge's profile
    const testUser = {
      id: '42025401',
      email: 'codanudge@gmail.com',
      firstName: 'Test',
      topStrengths: ['Strategic', 'Achiever', 'Focus', 'Responsibility', 'Analytical']
    };

    // Test week 1 email generation
    await emailService.sendWeeklyCoachingEmail(testUser, 1);
    console.log('Weekly email test completed successfully');

  } catch (error) {
    console.error('Weekly email test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWeeklyEmailDebug();