import { Resend } from 'resend';
import { render } from '@react-email/components';
import { WelcomeEmail, WeeklyNudgeEmail } from './server/emailTemplates.js';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmailSystem() {
  console.log('Testing React email templates with AI content...\n');
  
  try {
    // Test 1: Welcome Email Template
    console.log('1. Testing Welcome Email Template...');
    const welcomeHtml = await render(WelcomeEmail({
      firstName: 'Test User',
      strength1: 'Strategic',
      strength2: 'Achiever',
      challengeText: 'Identify one team project where you can apply strategic thinking while maintaining achiever momentum',
      nextMonday: 'Monday, December 30',
      greeting: 'Welcome to your strengths journey! Your Strategic + Achiever combination makes you a natural at turning vision into reality.',
      dna: 'You see the big picture and have the drive to make it happen. This combination helps you identify the best path forward and stay committed to achieving results.',
      whatsNext: 'Starting Monday, you will receive weekly coaching insights delivered at 9 AM. Each email contains practical strategies to help you apply your strengths.',
      cta: 'Start building your strengths-based leadership approach today',
      unsubscribeUrl: '#'
    }));

    const welcomeResult = await resend.emails.send({
      from: 'onboarding@tinymanager.ai',
      to: ['tinymanagerai@gmail.com'],
      subject: 'Welcome Test: React Template + AI Content',
      html: welcomeHtml,
    });

    if (welcomeResult.error) {
      console.error('Welcome email failed:', welcomeResult.error);
    } else {
      console.log('✅ Welcome email sent with React template! ID:', welcomeResult.data.id);
    }

    // Test 2: Weekly Coaching Email Template
    console.log('\n2. Testing Weekly Coaching Email Template...');
    const weeklyHtml = await render(WeeklyNudgeEmail({
      managerName: 'Test Manager',
      personalStrength: 'Strategic',
      personalTip: 'This week, use your Strategic strength to anticipate potential challenges in your current projects. Map out 2-3 scenarios and prepare contingency plans.',
      specificAction: 'Schedule 30 minutes to review your team\'s Q1 goals and identify which strategic initiatives need course correction',
      teamMemberName: 'Sarah',
      teamMemberStrength: 'Achiever',
      teamTip: 'Give Sarah specific deadlines and milestones - her Achiever strength thrives on clear progress markers',
      weekNumber: 1,
      dashboardUrl: 'https://your-app.replit.app/dashboard',
      unsubscribeUrl: '#'
    }));

    const weeklyResult = await resend.emails.send({
      from: 'onboarding@tinymanager.ai',
      to: ['tinymanagerai@gmail.com'],
      subject: 'Week 1 Test: React Template + AI Coaching',
      html: weeklyHtml,
    });

    if (weeklyResult.error) {
      console.error('Weekly email failed:', weeklyResult.error);
    } else {
      console.log('✅ Weekly email sent with React template! ID:', weeklyResult.data.id);
    }

    console.log('\n=== EMAIL TEMPLATE TEST RESULTS ===');
    console.log('Welcome Template:', welcomeResult.error ? '❌ Failed' : '✅ Success');
    console.log('Weekly Template:', weeklyResult.error ? '❌ Failed' : '✅ Success');
    console.log('\nBoth emails should now show:');
    console.log('- Proper React component styling');
    console.log('- AI-generated personalized content');
    console.log('- Professional email design');
    console.log('- Working from tinymanager.ai domain');

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testEmailSystem();