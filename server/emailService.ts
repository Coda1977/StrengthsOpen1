import { Resend } from 'resend';
import { User } from '../shared/schema';
import { storage } from './storage';
import { generateWeeklyEmailContent, generateWelcomeEmailContent } from './openai';
import { marked } from 'marked';

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

      // Use AI to generate welcome email content
      const aiContent = await generateWelcomeEmailContent(user.firstName || '', strength1, strength2, nextMondayStr);
      if ('error' in aiContent) {
        throw new Error('Failed to generate welcome email content: ' + aiContent.error);
      }

      // Convert all AI-generated fields from Markdown to HTML (await since marked returns a Promise)
      const greetingHtml = await marked(aiContent.greeting);
      const dnaHtml = await marked(aiContent.dna);
      const challengeHtml = await marked(aiContent.challengeText);
      const whatsNextHtml = await marked(aiContent.whatsNext);
      const ctaHtml = await marked(aiContent.cta);

      // Generate professional HTML using the AI-generated content
      const emailHtml = this.generateProfessionalWelcomeEmail(
        greetingHtml,
        dnaHtml,
        challengeHtml,
        whatsNextHtml,
        ctaHtml,
        nextMondayStr
      );

      // Send welcome email
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email!],
        subject: aiContent.subject,
        html: emailHtml,
      });

      if (error) {
        console.error('Welcome email failed to send:', error);
        throw new Error('Failed to send welcome email');
      }

      // Log successful email delivery (remove metadata property if not supported)
      await storage.createEmailLog({
        userId: user.id,
        emailType: 'welcome',
        emailSubject: aiContent.subject,
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

      // Convert all AI-generated fields from Markdown to HTML for weeklyContent (await since marked returns a Promise)
      weeklyContent.personalInsight = await marked(weeklyContent.personalInsight);
      weeklyContent.techniqueName = await marked(weeklyContent.techniqueName);
      weeklyContent.techniqueContent = await marked(weeklyContent.techniqueContent);
      weeklyContent.teamSection = await marked(weeklyContent.teamSection);
      weeklyContent.quote = await marked(weeklyContent.quote);
      weeklyContent.quoteAuthor = await marked(weeklyContent.quoteAuthor);
      weeklyContent.header = await marked(weeklyContent.header);
      weeklyContent.preHeader = await marked(weeklyContent.preHeader);
      weeklyContent.subjectLine = await marked(weeklyContent.subjectLine);

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
      'Strategic_Achiever': 'spot opportunities others miss, then actually follow through. That\'s a rare combination that most leaders struggle to develop.',
      'Strategic_Responsibility': 'create long-term plans you can fully commit to. That\'s a rare combination that most leaders struggle to develop.',
      'Strategic_Analytical': 'see patterns in data that reveal future possibilities. That\'s a rare combination that most leaders struggle to develop.',
      'Achiever_Responsibility': 'complete important work others can depend on. That\'s a rare combination that most leaders struggle to develop.',
      'Achiever_Focus': 'drive projects to completion without getting distracted. That\'s a rare combination that most leaders struggle to develop.',
      'Relator_Developer': 'build trust while growing people simultaneously. That\'s a rare combination that most leaders struggle to develop.',
      'Developer_Responsibility': 'invest in people with unwavering commitment. That\'s a rare combination that most leaders struggle to develop.',
      'Analytical_Responsibility': 'make data-driven decisions you can stand behind. That\'s a rare combination that most leaders struggle to develop.',
      'Communication_Relator': 'explain complex ideas in ways that build connection. That\'s a rare combination that most leaders struggle to develop.',
      'Ideation_Strategic': 'generate creative solutions with practical pathways. That\'s a rare combination that most leaders struggle to develop.',
      'Learner_Developer': 'continuously grow while helping others grow. That\'s a rare combination that most leaders struggle to develop.',
      'Focus_Achiever': 'maintain direction while delivering results consistently. That\'s a rare combination that most leaders struggle to develop.',
      'Responsibility_Relator': 'build deep relationships you can count on. That\'s a rare combination that most leaders struggle to develop.',
      'Communication_Strategic': 'articulate vision in ways that inspire action. That\'s a rare combination that most leaders struggle to develop.',
      'Ideation_Communication': 'turn creative ideas into compelling stories. That\'s a rare combination that most leaders struggle to develop.'
    };
    
    const key1 = `${s1}_${s2}`;
    const key2 = `${s2}_${s1}`;
    
    return combinations[key1] || combinations[key2] || `combine ${s1.toLowerCase()} thinking with ${s2.toLowerCase()} execution in unique ways. That's a rare combination that most leaders struggle to develop.`;
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
    greetingHtml: string,
    dnaHtml: string,
    challengeHtml: string,
    whatsNextHtml: string,
    ctaHtml: string,
    nextMonday: string
  ): string {
    // Use the refined welcome email template design following AI instructions
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Strengths Manager</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        body, p { margin: 0; }
        table { border-collapse: collapse; }
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
                max-width: 100% !important;
            }
            .content-padding {
                padding: 20px !important;
            }
            .mobile-text {
                font-size: 16px !important;
                line-height: 1.5 !important;
            }
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
                                Welcome to Strengths Manager
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td class="content-padding" style="padding: 0 32px 40px 32px;">
                            
                            <!-- Personal Greeting -->
                            <div style="margin-bottom: 32px;">
                                <div style="font-size: 18px; line-height: 1.6; margin: 0 0 16px 0; color: #0F172A;">
                                    ${greetingHtml}
                                </div>
                            </div>
                            <!-- Key Strengths Focus -->
                            <div style="background: #F1F5F9; border-radius: 8px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #CC9B00;">
                                <h2 style="color: #003566; font-size: 16px; font-weight: 700; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                                    Your Leadership DNA
                                </h2>
                                <div style="color: #0F172A; font-size: 18px; font-weight: 600; margin: 0 0 8px 0; line-height: 1.4;">
                                    ${dnaHtml}
                                </div>
                            </div>
                            <!-- Challenge Section -->
                            <div style="background: #FEF3C7; border-radius: 8px; padding: 20px; margin-bottom: 32px;">
                                <h3 style="color: #92400E; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">
                                    Try This Today:
                                </h3>
                                <div style="color: #1F2937; font-size: 15px; line-height: 1.5; margin: 0;">
                                    ${challengeHtml}
                                </div>
                            </div>
                            <!-- What's Next -->
                            <div style="margin-bottom: 32px;">
                                <h3 style="color: #003566; font-size: 18px; font-weight: 700; margin: 0 0 16px 0;">
                                    What happens next?
                                </h3>
                                <div style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                                    ${whatsNextHtml}
                                </div>
                            </div>
                            <!-- Next Step -->
                            <div style="background: #F8FAFC; border-radius: 8px; padding: 20px; text-align: center;">
                                <div style="color: #003566; font-size: 16px; font-weight: 600; margin: 0;">
                                    ${ctaHtml}
                                </div>
                                <div style="color: #6B7280; font-size: 14px; margin: 8px 0 0 0;">
                                    Get ready to lead differently.
                                </div>
                            </div>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td class="content-padding" style="padding: 24px 32px 32px 32px; border-top: 1px solid #E5E7EB;">
                            <div style="text-align: center;">
                                <p style="color: #6B7280; font-size: 14px; margin: 0 0 8px 0; font-weight: 500;">
                                    Strengths Manager
                                </p>
                                <p style="color: #9CA3AF; font-size: 13px; margin: 0 0 16px 0;">
                                    AI-powered leadership development
                                </p>
                                <!-- CAN-SPAM Compliance -->
                                <p style="margin: 16px 0 0 0;">
                                    <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/unsubscribe?token=${greetingHtml.split(' ')[1] || 'user'}" style="color: #6B7280; font-size: 12px; text-decoration: underline;">
                                        Unsubscribe
                                    </a>
                                </p>
                            </div>
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