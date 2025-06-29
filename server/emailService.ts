import { Resend } from 'resend';
import { User } from '../shared/schema';
import { storage } from './storage';
import { generateWeeklyEmailContent } from './openai';

export class EmailService {
  private resend = new Resend(process.env.RESEND_API_KEY);
  private fromEmail = 'onboarding@tinymanager.ai';

  async sendWelcomeEmail(user: User, timezone: string = 'America/New_York'): Promise<void> {
    try {
      const userStrengths = user.topStrengths || [];
      const strength1 = userStrengths[0] || 'Strategic';
      const strength2 = userStrengths[1] || 'Achiever';

      // Calculate next Monday
      const nextMonday = new Date();
      nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7));
      const nextMondayStr = nextMonday.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long', 
        day: 'numeric' 
      });

      // Generate welcome email content using your exact template
      const welcomeContent = {
        subject: `Welcome to your strengths journey, ${user.firstName || 'Manager'}`,
        greeting: `Hi ${user.firstName || 'Manager'},`,
        dna: `${strength1} + ${strength2} = ${this.generateDNAInsight(strength1, strength2)}`,
        challenge: this.generateChallenge(strength1),
        challengeText: this.generateChallenge(strength1),
        whatsNext: "Your first weekly coaching email arrives next Monday at 9 AM.",
        cta: "Start Building Your Team →",
        metrics: "12-week journey • Weekly insights • Personalized for your team"
      };

      // Generate professional HTML using your exact welcome email template
      const emailHtml = this.generateProfessionalWelcomeEmail(
        welcomeContent.greeting,
        strength1,
        strength2,
        welcomeContent.challengeText,
        nextMondayStr
      );

      // Send welcome email
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email!],
        subject: welcomeContent.subject,
        html: emailHtml,
      });

      if (error) {
        console.error('Welcome email failed to send:', error);
        throw new Error('Failed to send welcome email');
      }

      // Log successful email delivery
      await storage.createEmailLog({
        userId: user.id,
        emailType: 'welcome',
        emailSubject: welcomeContent.subject,
        resendId: data?.id,
        status: 'sent'
      });

      console.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  }

  async sendWeeklyCoachingEmail(user: User, weekNumber: number): Promise<void> {
    try {
      // Get user's team members for AI context
      const teamMembers = await storage.getTeamMembers(user.id);
      const userStrengths = user.topStrengths || [];
      
      if (teamMembers.length === 0) {
        console.log(`Skipping weekly email for ${user.email} - no team members`);
        return;
      }

      // Select featured team member and strength for this week
      const featuredMemberIndex = (weekNumber - 1) % teamMembers.length;
      const featuredMember = teamMembers[featuredMemberIndex];
      const memberStrengths = featuredMember.strengths || [];
      const featuredStrength = userStrengths[(weekNumber - 1) % userStrengths.length] || 'Strategic';
      const teamMemberFeaturedStrength = memberStrengths[0] || 'Focus';

      // Generate AI-powered weekly email content following your exact instructions
      const weeklyContent = await generateWeeklyEmailContent(
        user.firstName || 'Manager',
        userStrengths,
        weekNumber,
        teamMembers.length,
        featuredStrength,
        featuredMember.name,
        memberStrengths,
        teamMemberFeaturedStrength,
        [], // previousPersonalTips - would track from email logs
        [], // previousOpeners - would track from email logs  
        []  // previousTeamMembers - would track from email logs
      );

      // Generate professional HTML using your exact weekly email template
      const emailHtml = this.generateProfessionalWeeklyEmail(
        weeklyContent,
        user.firstName || 'Manager',
        featuredStrength,
        weeklyContent.techniqueContent || 'Apply your strength this week',
        featuredMember.name,
        teamMemberFeaturedStrength,
        weeklyContent.teamSection,
        weekNumber
      );

      // Send weekly coaching email
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email!],
        subject: weeklyContent.subjectLine,
        html: emailHtml,
      });

      if (error) {
        console.error('Weekly email failed to send:', error);
        throw new Error('Failed to send weekly email');
      }

      // Log successful email delivery
      await storage.createEmailLog({
        userId: user.id,
        emailType: 'weekly_coaching',
        emailSubject: weeklyContent.subjectLine,
        resendId: data?.id,
        status: 'sent',
        weekNumber: weekNumber.toString()
      });

      console.log(`Weekly email ${weekNumber} sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending weekly email:', error);
      throw error;
    }
  }

  // Helper methods for welcome email content generation
  private generateDNAInsight(s1: string, s2: string): string {
    const combinations: { [key: string]: string } = {
      'Strategic_Achiever': 'spot opportunities others miss, then actually follow through',
      'Strategic_Responsibility': 'create long-term plans you can fully commit to',
      'Strategic_Analytical': 'see patterns in data that reveal future possibilities',
      'Achiever_Responsibility': 'complete important work others can depend on',
      'Achiever_Focus': 'drive projects to completion without getting distracted',
      'Relator_Developer': 'build trust while growing people simultaneously',
      'Developer_Responsibility': 'invest in people with unwavering commitment',
      'Analytical_Responsibility': 'make data-driven decisions you can stand behind',
      'Communication_Relator': 'explain complex ideas in ways that build connection',
      'Ideation_Strategic': 'generate creative solutions with practical pathways'
    };
    
    const key1 = `${s1}_${s2}`;
    const key2 = `${s2}_${s1}`;
    
    return combinations[key1] || combinations[key2] || `combine ${s1.toLowerCase()} thinking with ${s2.toLowerCase()} execution in unique ways`;
  }

  private generateChallenge(strength: string): string {
    const challenges: { [key: string]: string } = {
      'Strategic': 'In your next meeting, notice how you naturally see 3 different approaches to any problem. That\'s your Strategic mind at work.',
      'Achiever': 'Count how many small wins you create for your team in one day. Your drive creates momentum others feel.',
      'Relator': 'Have one important conversation without checking your phone once. Notice how much deeper you connect.',
      'Developer': 'Catch someone doing something well today and tell them specifically what growth you see in them.',
      'Analytical': 'Question one assumption in your next project review. Your logical mind catches what others miss.',
      'Focus': 'Set one clear priority for tomorrow and protect it fiercely. Watch how your clarity creates team direction.',
      'Responsibility': 'Make one promise to yourself today and keep it completely. Your reliability builds trust.',
      'Communication': 'Explain one complex idea using a simple story. Your ability to clarify creates understanding.',
      'Ideation': 'Generate three wild solutions to your current challenge. Your creativity unlocks possibilities.',
      'Learner': 'Teach someone something you learned this week. Your curiosity becomes their growth.'
    };
    
    return challenges[strength] || `Notice how your ${strength} strength shows up in unexpected moments today.`;
  }

  private generateProfessionalWelcomeEmail(
    greeting: string,
    strength1: string,
    strength2: string,
    challengeText: string,
    nextMonday: string
  ): string {
    // Use your exact welcome email template design with proper beige background
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Strengths Manager</title>
    <style>
        body, p { margin: 0; }
        table { border-collapse: collapse; }
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; }
            .content-padding { padding: 20px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0E8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A;">
    
    <!-- Hidden pre-header -->
    <span style="display:none; font-size:1px; color:#F5F0E8; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
        Your 12-week strengths journey starts now
    </span>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0E8; min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table class="email-container" width="100%" style="max-width: 540px; background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);" cellpadding="0" cellspacing="0">
                    
                    <!-- Header -->
                    <tr>
                        <td class="content-padding" style="padding: 40px 32px 32px 32px; text-align: center;">
                            <h1 style="color: #003566; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">
                                Welcome to Your Strengths Journey
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td class="content-padding" style="padding: 0 32px 32px 32px;">
                            <p style="color: #0F172A; font-size: 18px; line-height: 1.6; margin: 0 0 24px 0;">
                                ${greeting}
                            </p>
                            
                            <div style="background-color: #F8F9FA; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                                <h2 style="color: #003566; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
                                    Your Unique DNA
                                </h2>
                                <p style="color: #0F172A; font-size: 16px; line-height: 1.5; margin: 0;">
                                    <strong>${strength1}</strong> + <strong>${strength2}</strong> = ${this.generateDNAInsight(strength1, strength2)}
                                </p>
                            </div>
                            
                            <div style="background-color: #FFF4E6; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
                                <h2 style="color: #CC9B00; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
                                    This Week's Challenge
                                </h2>
                                <p style="color: #0F172A; font-size: 16px; line-height: 1.5; margin: 0;">
                                    ${challengeText}
                                </p>
                            </div>
                            
                            <p style="color: #6B7280; font-size: 16px; line-height: 1.5; margin: 0 0 32px 0;">
                                Your first weekly coaching email arrives <strong>${nextMonday} at 9 AM</strong>.
                            </p>
                            
                            <div style="text-align: center;">
                                <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/dashboard" style="background-color: #003566; border-radius: 8px; color: #FFFFFF; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 14px 32px;">
                                    Start Building Your Team →
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="text-align: center; padding: 20px 32px 40px 32px; border-top: 1px solid #E5E7EB;">
                            <p style="color: #9CA3AF; font-size: 13px; margin: 0;">
                                Tiny Strength Manager
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
  }

  private generateProfessionalWeeklyEmail(
    weeklyContent: any,
    managerName: string,
    personalStrength: string,
    specificAction: string,
    teamMemberName: string,
    teamMemberStrength: string,
    teamTip: string,
    weekNumber: number
  ): string {
    // Use your exact weekly email template design with proper structure and beige background
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Week ${weekNumber} Strengths Coaching</title>
    <style>
        body, p { margin: 0; }
        table { border-collapse: collapse; }
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; }
            .content-padding { padding: 20px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0E8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A;">
    
    <!-- Hidden pre-header -->
    <span style="display:none; font-size:1px; color:#F5F0E8; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
        ${weeklyContent.preHeader}
    </span>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0E8; min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table class="email-container" width="100%" style="max-width: 540px;" cellpadding="0" cellspacing="0">
                    
                    <!-- Header -->
                    <tr>
                        <td style="padding-bottom: 24px; text-align: center;">
                            <h1 style="color: #003566; font-size: 18px; font-weight: 600; margin: 0; letter-spacing: -0.25px;">
                                ${weeklyContent.header}
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Primary Card - Personal Insight -->
                    <tr>
                        <td style="padding-bottom: 20px;">
                            <div style="background-color: #FFFFFF; border-radius: 12px; padding: 32px 28px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
                                <div style="background-color: #CC9B00; color: #0F172A; font-size: 12px; font-weight: 700; letter-spacing: 1px; padding: 6px 12px; border-radius: 20px; display: inline-block; margin-bottom: 16px; text-transform: uppercase;">
                                    ${personalStrength}
                                </div>
                                <div style="color: #0F172A; font-size: 17px; line-height: 1.6; margin: 0 0 20px 0; font-weight: 400;">
                                    ${weeklyContent.personalInsight}
                                </div>
                                <div style="height: 1px; background-color: #E5E7EB; margin: 20px 0;"></div>
                                <div style="color: #4A4A4A; font-size: 16px; line-height: 1.5; margin: 0;">
                                    <span style="color: #003566; font-weight: 600;" role="img" aria-label="technique">►</span> <strong>${weeklyContent.techniqueName}:</strong> ${weeklyContent.techniqueContent}
                                </div>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Team Section -->
                    <tr>
                        <td style="padding-bottom: 32px;">
                            <div style="background-color: #FFFFFF; border-radius: 12px; padding: 20px 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);">
                                <div style="color: #003566; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; text-transform: uppercase;">
                                    <span role="img" aria-label="team insight">▶</span> Team Insight
                                </div>
                                <div style="color: #0F172A; font-size: 15px; line-height: 1.5; margin: 0;">
                                    ${weeklyContent.teamSection}
                                </div>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Quote Section -->
                    <tr>
                        <td style="padding-bottom: 32px;">
                            <div style="background-color: rgba(204, 155, 0, 0.1); border-radius: 12px; padding: 20px 24px; border-left: 4px solid #CC9B00;">
                                <div style="color: #0F172A; font-size: 16px; line-height: 1.5; font-style: italic; margin-bottom: 8px;">
                                    "${weeklyContent.quote}"
                                </div>
                                <div style="color: #6B7280; font-size: 14px; font-weight: 500;">
                                    — ${weeklyContent.quoteAuthor}
                                </div>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                        <td style="text-align: center; padding-bottom: 40px;">
                            <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/dashboard" style="background-color: #003566; border-radius: 8px; color: #FFFFFF; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 14px 32px;">
                                View Dashboard →
                            </a>
                            <p style="margin-top: 16px; text-align: center;">
                                <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/unsubscribe?token=${managerName}" style="color: #6B7280; font-size: 14px; text-decoration: underline;">
                                    Unsubscribe
                                </a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB;">
                            <p style="color: #9CA3AF; font-size: 13px; margin: 0; font-weight: 500;">
                                Tiny Strength Manager
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
  }

  async processWeeklyEmails(): Promise<void> {
    try {
      console.log('Processing weekly emails...');
      // Implementation for bulk weekly email processing
      // This would be called by the email scheduler
    } catch (error) {
      console.error('Error processing weekly emails:', error);
    }
  }
}

export const emailService = new EmailService();