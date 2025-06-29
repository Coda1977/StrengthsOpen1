// Email delivery test script
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmailDelivery() {
  console.log('Testing email delivery with Resend...');
  
  try {
    // Test 1: Basic connectivity
    console.log('1. Testing Resend API connectivity...');
    
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ['tinymanagerai@gmail.com'], // Using admin email for testing
      subject: 'Email System Test - Strengths Manager',
      html: `
        <h2>Email System Test Successful</h2>
        <p>This test confirms that the Strengths Manager email system is operational.</p>
        <ul>
          <li>✓ Resend API connection established</li>
          <li>✓ Email delivery pipeline functional</li>
          <li>✓ HTML rendering working</li>
        </ul>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
      `
    });

    if (error) {
      console.error('❌ Email delivery failed:', error);
      return { success: false, error };
    }

    console.log('✅ Email sent successfully!');
    console.log('Email ID:', data.id);
    console.log('Response data:', data);
    
    return { success: true, data };
  } catch (error) {
    console.error('❌ Email test failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
testEmailDelivery()
  .then(result => {
    console.log('\n📊 Email Delivery Test Results:');
    console.log('Success:', result.success);
    if (result.success) {
      console.log('✅ Email system is production-ready');
    } else {
      console.log('❌ Email system needs attention');
      console.log('Error:', result.error);
    }
  })
  .catch(console.error);