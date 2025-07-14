import { Resend } from 'resend';
import { User } from '../shared/schema';
import { storage } from './storage';
import { generateWeeklyEmailContent, generateWelcomeEmailContent } from './openai';
import crypto from 'crypto';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
// marked removed - using custom content cleaning instead

export class EmailService {
  private resend = new Resend(process.env.RESEND_API_KEY);
  private fromEmail = 'strengths@tinymanager.ai';

  // Generate a cryptographically secure unsubscribe token
  private generateUnsubscribeToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create or get an unsubscribe token for a user
  private async getOrCreateUnsubscribeToken(userId: string, emailType: 'welcome' | 'weekly_coaching' | 'all' = 'all'): Promise<string> {
    try {
      // Check if user already has a valid token
      const existingTokens = await storage.getUnsubscribeTokens(userId);
      const validToken = existingTokens.find(token => 
        token.emailType === emailType && 
        !token.usedAt && 
        token.expiresAt > new Date()
      );

      if (validToken) {
        return validToken.token;
      }

      // Create new token
      const token = this.generateUnsubscribeToken();
      await storage.createUnsubscribeToken(userId, token, emailType);
      return token;
    } catch (error) {
      console.error('Error creating unsubscribe token:', error);
      // Fallback to a simple token if storage fails
      return crypto.randomBytes(16).toString('hex');
    }
  }

  async sendAuthorizationWelcomeEmail(email: string, firstName: string, websiteUrl: string): Promise<void> {
    try {
      const authEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #F5F0E8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: #FFFFFF; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
              <h1 style="color: #1A1A1A; font-size: 28px; font-weight: 700; margin: 0 0 24px 0; text-align: center;">
                Welcome to Strengths Manager! 🎉
              </h1>
              
              <p style="color: #4A4A4A; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi ${firstName},
              </p>
              
              <p style="color: #4A4A4A; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Great news! Your account has been successfully authorized and you're now ready to unlock the power of CliftonStrengths for you and your team.
              </p>
              
              <div style="background-color: #F8F6F0; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h3 style="color: #1A1A1A; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
                  What's Next?
                </h3>
                <p style="color: #4A4A4A; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
                  Complete your onboarding by selecting your top 5 CliftonStrengths to start receiving personalized AI coaching insights.
                </p>
                <a href="${websiteUrl}/onboarding" style="display: inline-block; background-color: #FFD60A; color: #1A1A1A; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  Complete Your Profile
                </a>
              </div>
              
              <div style="border-top: 1px solid #E5E5E5; padding-top: 24px; margin-top: 32px;">
                <p style="color: #8A8A8A; font-size: 12px; line-height: 1.4; margin: 0; text-align: center;">
                  Visit our website: <a href="${websiteUrl}" style="color: #FFD60A; text-decoration: none;">${websiteUrl.replace('https://', '')}</a>
                  <br>
                  Questions? Reply to this email or contact us anytime.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Welcome to Strengths Manager - Let\'s Get Started!',
        html: authEmailHtml,
      });

      if (error) {
        console.error('Authorization welcome email failed to send:', error);
        throw new Error('Failed to send authorization welcome email');
      }

      console.log(`Authorization welcome email sent to ${email}`);
    } catch (error) {
      console.error('Error sending authorization welcome email:', error);
      throw error;
    }
  }

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

      // Generate secure unsubscribe token
      const unsubscribeToken = await this.getOrCreateUnsubscribeToken(user.id, 'welcome');

      // Use AI to generate welcome email content
      const aiContent = await generateWelcomeEmailContent(user.firstName || '', strength1, strength2, nextMondayStr);
      if ('error' in aiContent) {
        throw new Error('Failed to generate welcome email content: ' + aiContent.error);
      }

      // Clean AI-generated content for proper display
      const cleanWelcomeContent = (content: string) => {
        if (!content) return '';
        return content
          .replace(/<[^>]*>/g, '') // Remove any HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
          .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
          .trim();
      };

      const greetingHtml = cleanWelcomeContent(aiContent.greeting);
      const dnaHtml = cleanWelcomeContent(aiContent.dna);
      const challengeHtml = cleanWelcomeContent(aiContent.challengeText);
      const whatsNextHtml = cleanWelcomeContent(aiContent.whatsNext);
      const ctaHtml = cleanWelcomeContent(aiContent.cta);

      // Generate professional HTML using the AI-generated content
      const emailHtml = this.generateProfessionalWelcomeEmail(
        greetingHtml,
        dnaHtml,
        challengeHtml,
        whatsNextHtml,
        ctaHtml,
        nextMondayStr,
        unsubscribeToken
      );

      // Clean subject line - ensure it's plain text without newlines
      const cleanSubject = aiContent.subject
        .replace(/<[^>]*>/g, '') // Remove any HTML tags
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .trim();

      // Send welcome email
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email!],
        subject: cleanSubject,
        html: emailHtml,
      });

      if (error) {
        if (process.env.NODE_ENV !== 'production') console.error('Welcome email failed to send:', error);
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

      if (process.env.NODE_ENV !== 'production') console.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error sending welcome email:', error);
      throw error;
    }
  }

  async sendWeeklyCoachingEmail(user: User, weekNumber: number): Promise<void> {
    try {
      // Get user's team members for AI context
      const teamMembers = await storage.getTeamMembers(user.id);
      const userStrengths = user.topStrengths || [];

      if (teamMembers.length === 0) {
        if (process.env.NODE_ENV !== 'production') console.log(`Skipping weekly email for ${user.email} - no team members`);
        return;
      }

      // Generate secure unsubscribe token
      const unsubscribeToken = await this.getOrCreateUnsubscribeToken(user.id, 'weekly_coaching');

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
        [], // previousTeamMembers - would track from email logs
        user.id // userId for usage tracking
      );

      // Function to add natural line breaks at appropriate points
      const addIntelligentLineBreaks = (text: string): string => {
        // First, fix missing spaces after periods and other punctuation
        let cleaned = text
          .replace(/([.!?])([A-Z])/g, '$1 $2') // Add space after period before capital letter
          .replace(/([.!?])([a-z])/g, '$1 $2') // Add space after period before lowercase (for edge cases)
          .replace(/\s+/g, ' ') // Normalize multiple spaces
          .trim();
        
        // Split into sentences with better regex that handles the fixed spacing
        const sentences = cleaned.split(/(?<=[.!?])\s+/);
        
        // Group sentences into logical paragraphs
        const paragraphs: string[] = [];
        let currentParagraph: string[] = [];
        
        sentences.forEach((sentence, index) => {
          const trimmedSentence = sentence.trim();
          if (!trimmedSentence) return;
          
          currentParagraph.push(trimmedSentence);
          
          // Enhanced pattern detection for natural break points
          const isTransition = 
            // Explicit transition phrases
            trimmedSentence.includes('Instead of') ||
            trimmedSentence.includes('Your action:') ||
            trimmedSentence.includes('This week:') ||
            trimmedSentence.includes('Combine it with') ||
            trimmedSentence.includes('Harness this') ||
            trimmedSentence.includes('Focus on') ||
            trimmedSentence.includes('Notice how') ||
            trimmedSentence.includes('Start with') ||
            trimmedSentence.includes('Break it into') ||
            trimmedSentence.includes('This focus') ||
            // Questions that should start new paragraphs
            trimmedSentence.match(/^(Know what|Want to|Ready to|How do)/i) ||
            // Technique-related breaks
            trimmedSentence.includes('Elevate by') ||
            trimmedSentence.includes('Clarify your') ||
            // Length-based breaks (longer content needs more breaks)
            (currentParagraph.length >= 2 && currentParagraph.join(' ').length > 100);
          
          // Force paragraph break at the end or when transition detected
          if (isTransition || index === sentences.length - 1) {
            paragraphs.push(currentParagraph.join(' '));
            currentParagraph = [];
          }
        });
        
        // Join paragraphs with proper line breaks for email HTML
        return paragraphs
          .filter(p => p.trim().length > 0)
          .join('<br><br>');
      };

      // Enhanced function to properly format AI content for email with natural line breaks
      const cleanContent = (content: string) => {
        if (!content) return '';
        
        // First clean any existing HTML tags and normalize whitespace
        let cleaned = content
          .replace(/<[^>]*>/g, '') // Remove any HTML tags
          .replace(/\s+/g, ' ') // Replace multiple spaces/newlines with single space
          .trim();
        
        // Convert markdown-style formatting to HTML
        cleaned = cleaned
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
          .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
          .replace(/`(.*?)`/g, '<code>$1</code>'); // Code
        
        // Add intelligent paragraph breaks for better readability
        cleaned = addIntelligentLineBreaks(cleaned);
        
        return cleaned;
      };

      // Clean simple text fields (no HTML needed)
      const cleanSimpleText = (content: string) => {
        if (!content) return '';
        return content
          .replace(/<[^>]*>/g, '') // Remove any HTML tags
          .replace(/\n/g, ' ') // Replace newlines with spaces
          .trim();
      };

      // Process content fields appropriately
      weeklyContent.personalInsight = cleanContent(weeklyContent.personalInsight);
      weeklyContent.techniqueContent = cleanContent(weeklyContent.techniqueContent);
      weeklyContent.teamSection = cleanContent(weeklyContent.teamSection);
      weeklyContent.techniqueName = cleanSimpleText(weeklyContent.techniqueName);
      weeklyContent.quote = cleanSimpleText(weeklyContent.quote);
      weeklyContent.quoteAuthor = cleanSimpleText(weeklyContent.quoteAuthor);
      weeklyContent.header = cleanSimpleText(weeklyContent.header);
      weeklyContent.preHeader = cleanSimpleText(weeklyContent.preHeader);
      weeklyContent.subjectLine = cleanSimpleText(weeklyContent.subjectLine);

      // Ensure content consistency - verify the AI content matches the featured strength
      if (!weeklyContent.personalInsight.toLowerCase().includes(featuredStrength.toLowerCase())) {
        if (process.env.NODE_ENV !== 'production') console.warn('AI content mismatch detected, using fallback content');
        weeklyContent.personalInsight = `Your ${featuredStrength} strength gives you a unique advantage this week. You naturally ${this.getStrengthAction(featuredStrength)}, which sets you apart from other leaders.`;
        weeklyContent.techniqueName = `${featuredStrength} Focus`;
        weeklyContent.techniqueContent = `This week, consciously apply your ${featuredStrength} strength in one key decision or interaction. Notice how it changes the outcome.`;
      }

      // Apply content formatting to AI-generated text for better readability
      const formattedWeeklyContent = {
        ...weeklyContent,
        personalInsight: cleanContent(weeklyContent.personalInsight),
        techniqueContent: cleanContent(weeklyContent.techniqueContent),
        teamSection: cleanContent(weeklyContent.teamSection)
      };

      // Generate professional HTML using your exact weekly email template
      const emailHtml = this.generateProfessionalWeeklyEmail(
        formattedWeeklyContent,
        user.firstName || 'Manager',
        featuredStrength,
        formattedWeeklyContent.techniqueContent || 'Apply your strength this week',
        featuredMember.name,
        teamMemberFeaturedStrength,
        formattedWeeklyContent.teamSection,
        weekNumber,
        unsubscribeToken
      );

      // Send weekly coaching email
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email!],
        subject: weeklyContent.subjectLine,
        html: emailHtml,
      });

      if (error) {
        if (process.env.NODE_ENV !== 'production') console.error('Weekly email failed to send:', error);
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

      if (process.env.NODE_ENV !== 'production') console.log(`Weekly email ${weekNumber} sent to ${user.email}`);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error sending weekly email:', error);
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

  private getStrengthAction(strength: string): string {
    const actions: { [key: string]: string } = {
      'Strategic': 'see multiple pathways to success',
      'Achiever': 'drive consistent progress toward goals',
      'Relator': 'build deep, authentic relationships',
      'Developer': 'spot growth potential in others',
      'Analytical': 'find logical patterns others miss',
      'Focus': 'maintain direction when others get distracted',
      'Responsibility': 'follow through on commitments completely',
      'Communication': 'make complex ideas clear and compelling',
      'Ideation': 'generate creative solutions to problems',
      'Learner': 'continuously acquire new knowledge and skills'
    };

    return actions[strength] || 'leverage your natural talents effectively';
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
    nextMonday: string,
    unsubscribeToken: string
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
                                    <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/unsubscribe?token=${unsubscribeToken}" style="color: #6B7280; font-size: 12px; text-decoration: underline;">
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
    weekNumber: number,
    unsubscribeToken: string
  ): string {

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Week ${weekNumber} Strengths Coaching</title>
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
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0E8; font-family: Arial, Helvetica, sans-serif; color: #0F172A; line-height: 1.4;">

    <!-- Hidden pre-header -->
    <span style="display:none; font-size:1px; color:#F5F0E8; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
        ${weeklyContent.preHeader || 'Your weekly strength insight'}
    </span>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F5F0E8; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="540" cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; width: 100%;">

                    <!-- Header -->
                    <tr>
                        <td style="padding-bottom: 24px; text-align: center;">
                            <h1 style="color: #003566; font-size: 18px; font-weight: 600; margin: 0; font-family: Arial, Helvetica, sans-serif;">
                                ${weeklyContent.header || `Week ${weekNumber}: Your ${personalStrength} strength spotlight`}
                            </h1>
                        </td>
                    </tr>

                    <!-- Primary Card - Personal Insight -->
                    <tr>
                        <td style="padding-bottom: 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding: 32px 28px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td>
                                                    <span style="background-color: #CC9B00; color: #0F172A; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 20px; display: inline-block; margin-bottom: 16px; text-transform: uppercase; font-family: Arial, Helvetica, sans-serif;">
                                                        ${personalStrength}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="color: #0F172A; font-size: 17px; line-height: 1.7; padding-bottom: 20px; font-family: Arial, Helvetica, sans-serif;">
                                                    ${weeklyContent.personalInsight || 'Your strength insight for this week.'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="border-top: 1px solid #E5E7EB; padding-top: 20px;">
                                                    <div style="margin-bottom: 8px;">
                                                        <span style="color: #003566; font-weight: 600; font-family: Arial, Helvetica, sans-serif; font-size: 14px;">► ${weeklyContent.techniqueName || 'This Week\'s Focus'}:</span>
                                                    </div>
                                                    <div style="color: #374151; font-size: 15px; line-height: 1.7; font-family: Arial, Helvetica, sans-serif;">
                                                        ${weeklyContent.techniqueContent || 'Apply your strength in one key interaction this week.'}
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Team Section -->
                    <tr>
                        <td style="padding-bottom: 32px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding: 24px 28px;">
                                        <div style="color: #CC9B00; font-size: 12px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px;">
                                            TEAM INSIGHT
                                        </div>
                                        <div style="color: #0F172A; font-size: 16px; line-height: 1.7; margin: 0; font-family: Arial, Helvetica, sans-serif;">
                                            ${weeklyContent.teamSection || `This week: ${teamMemberName}'s ${teamMemberStrength} needs focused challenges. Instead of overwhelming them with busy work, provide one meaningful project. Your action: Schedule 15 minutes to discuss their learning goals.`}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Quote Section -->
                    <tr>
                        <td style="padding-bottom: 32px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FEF3C7; border-radius: 12px; border-left: 4px solid #CC9B00;">
                                <tr>
                                    <td style="padding: 20px 24px;">
                                        <div style="color: #0F172A; font-size: 16px; line-height: 1.5; font-style: italic; margin-bottom: 8px; font-family: Arial, Helvetica, sans-serif;">
                                            "${weeklyContent.quote || 'Success usually comes to those who are too busy to be looking for it.'}"
                                        </div>
                                        <div style="color: #6B7280; font-size: 14px; font-weight: 500; font-family: Arial, Helvetica, sans-serif;">
                                            — ${weeklyContent.quoteAuthor || 'Henry David Thoreau'}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA Button -->
                    <tr>
                        <td style="text-align: center; padding-bottom: 40px;">
                            <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                                <tr>
                                    <td style="background-color: #003566; border-radius: 8px; text-align: center;">
                                        <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/dashboard" style="display: block; color: #FFFFFF; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; font-family: Arial, Helvetica, sans-serif;">
                                            View Dashboard →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB;">
                            <p style="color: #9CA3AF; font-size: 13px; margin: 0 0 16px 0; font-weight: 500; font-family: Arial, Helvetica, sans-serif;">
                                Strengths Manager
                            </p>
                            <p style="margin: 0;">
                                <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/unsubscribe?token=${unsubscribeToken}" style="color: #6B7280; font-size: 12px; text-decoration: underline; font-family: Arial, Helvetica, sans-serif;">
                                    Unsubscribe
                                </a>
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
      if (process.env.NODE_ENV !== 'production') console.log('Processing weekly emails...');
      // Query all active weekly_coaching subscriptions
      const { db } = await import('./db');
      const { emailSubscriptions, users } = await import('../shared/schema');
      const activeSubs = await db.select()
        .from(emailSubscriptions)
        .where(and(
          eq(emailSubscriptions.isActive, true),
          eq(emailSubscriptions.emailType, 'weekly_coaching')
        ));

      let sent = 0;
      let failed = 0;
      for (const sub of activeSubs) {
        try {
          // Get user
          const [user] = await db.select().from(users).where(eq(users.id, sub.userId));
          if (!user) continue;

          // Check if we already sent an email today (daily limit protection)
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Reset to start of day
          
          if (sub.lastEmailDate && sub.lastEmailDate >= today) {
            // Already sent today, skip
            if (process.env.NODE_ENV !== 'production') console.log(`Skipped daily limit: already sent email today for user ${user.email}`);
            continue;
          }

          // Determine week number
          const currentCount = parseInt(sub.weeklyEmailCount || '0', 10);
          const weekNumber = currentCount + 1;
          if (weekNumber > 12) continue; // Only send up to 12 weeks

          // PRE-CHECK: Verify this user should receive an email (no double processing)
          const preCheck = await db.select()
            .from(emailSubscriptions)
            .where(and(
              eq(emailSubscriptions.id, sub.id),
              eq(emailSubscriptions.weeklyEmailCount, String(currentCount)),
              // Ensure lastEmailDate is not today
              or(
                isNull(emailSubscriptions.lastEmailDate),
                lt(emailSubscriptions.lastEmailDate, today)
              )
            ));

          if (preCheck.length === 0) {
            // Another process already updated this subscription or email already sent today; skip sending
            if (process.env.NODE_ENV !== 'production') console.warn(`Skipped duplicate weekly email for user ${user.email}`);
            continue;
          }

          // SEND EMAIL FIRST - only update database if successful
          await this.sendWeeklyCoachingEmail(user, weekNumber);

          // ATOMIC UPDATE: Only update if email was successfully sent AND conditions still valid
          const updateResult = await db.update(emailSubscriptions)
            .set({
              weeklyEmailCount: String(weekNumber),
              lastSentAt: new Date(),
              lastEmailDate: today,
              updatedAt: new Date(),
            })
            .where(and(
              eq(emailSubscriptions.id, sub.id),
              eq(emailSubscriptions.weeklyEmailCount, String(currentCount)),
              // Additional check: ensure lastEmailDate is still not today
              or(
                isNull(emailSubscriptions.lastEmailDate),
                lt(emailSubscriptions.lastEmailDate, today)
              )
            ))
            .returning();

          if (updateResult.length === 0) {
            // Race condition: another process updated while we were sending email
            if (process.env.NODE_ENV !== 'production') console.warn(`Race condition detected for user ${user.email} - email sent but not tracked`);
          }

          sent++;
        } catch (err) {
          failed++;
          if (process.env.NODE_ENV !== 'production') console.error('Failed to send weekly email for subscription', sub.id, err);
        }
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Weekly email processing complete. Sent: ${sent}, Failed: ${failed}`);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error processing weekly emails:', error);
    }
  }
}

export const emailService = new EmailService();