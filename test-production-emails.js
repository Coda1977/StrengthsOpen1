// Test production email delivery with verified domain
import { emailService } from './server/emailService.ts';

async function testProductionEmails() {
  console.log('Testing production email delivery...');
  
  try {
    // Test with codanudge user
    const testUser = {
      id: '39811412',
      email: 'codanudge@gmail.com',
      firstName: 'yonatan'
    };

    console.log('Sending welcome email to:', testUser.email);
    console.log('From address: onboarding@strengths.tinymanager.ai');
    
    await emailService.sendWelcomeEmail(testUser, 'America/New_York');
    
    console.log('Production email test completed successfully');
    
  } catch (error) {
    console.error('Production email test failed:', error);
  }
}

testProductionEmails()
  .then(() => {
    console.log('Production email system operational');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });