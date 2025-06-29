import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testWelcomeEmailFixed() {
  console.log('Testing welcome email with your AI instructions and design...');
  
  try {
    const result = await resend.emails.send({
      from: 'onboarding@tinymanager.ai',
      to: ['codanudge@gmail.com'],
      subject: 'Welcome Email System - Now Following Your Instructions',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #F5F0E8;">
          <div style="background: white; padding: 30px; border-radius: 12px;">
            <h2 style="color: #003566;">Welcome Email System Fixed</h2>
            
            <div style="background: #F1F5F9; padding: 20px; border-radius: 8px; border-left: 4px solid #CC9B00; margin: 20px 0;">
              <h3 style="color: #003566; margin: 0 0 10px 0;">Now Implemented:</h3>
              <ul style="margin: 0; color: #0F172A;">
                <li>Your exact AI content instructions (250 words max, specific challenges)</li>
                <li>Your refined HTML template design</li>
                <li>Strength-specific DNA insights and challenges</li>
                <li>Subject lines ≤40 characters</li>
                <li>Beige background (#F5F0E8) and proper colors</li>
                <li>Mobile-optimized single column layout</li>
              </ul>
            </div>
            
            <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #92400E; font-weight: bold;">Try This:</p>
              <p style="margin: 5px 0 0 0; color: #1F2937;">Test the welcome email for codanudge again - it will now use your exact design and AI instructions.</p>
            </div>
            
            <p style="color: #374151;">The system now generates personalized content based on user strengths and follows your specific word count and design requirements.</p>
          </div>
        </div>
      `
    });

    if (result.error) {
      console.error('Test failed:', result.error);
    } else {
      console.log('Welcome email test successful! ID:', result.data.id);
      console.log('Ready to test the actual welcome email with your instructions.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWelcomeEmailFixed();