import { Resend } from 'resend';
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { emailSubscriptions, emailLogs, users } from '../shared/schema';
import type { InsertEmailSubscription, InsertEmailLog, User } from '../shared/schema';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  private fromEmail = 'onboarding@strengthsmanager.com';
  
  async sendWelcomeEmail(user: User, timezone: string = 'America/New_York'): Promise<void> {
    try {
      // Create email subscription for this user
      await db.insert(emailSubscriptions).values({
        userId: user.id,
        emailType: 'welcome',
        timezone,
        isActive: true,
      });

      // Also create weekly coaching subscription
      await db.insert(emailSubscriptions).values({
        userId: user.id,
        emailType: 'weekly_coaching',
        timezone,
        isActive: true,
        weeklyEmailCount: '0',
      });

      const welcomeHtml = this.generateWelcomeEmailHtml(user);
      
      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [user.email!],
        subject: 'Welcome to Strengths Manager! 🎯',
        html: welcomeHtml,
      });

      // Log the email attempt
      await db.insert(emailLogs).values({
        userId: user.id,
        emailType: 'welcome',
        emailSubject: 'Welcome to Strengths Manager! 🎯',
        resendId: data?.id,
        status: error ? 'failed' : 'sent',
        errorMessage: error?.message,
      });

      if (error) {
        console.error('Failed to send welcome email:', error);
        throw new Error(`Failed to send welcome email: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in sendWelcomeEmail:', error);
      throw error;
    }
  }

  async sendWeeklyCoachingEmail(user: User, weekNumber: number): Promise<void> {
    try {
      // Check if user still has active weekly subscription and hasn't exceeded 12 weeks
      const subscription = await db
        .select()
        .from(emailSubscriptions)
        .where(
          and(
            eq(emailSubscriptions.userId, user.id),
            eq(emailSubscriptions.emailType, 'weekly_coaching'),
            eq(emailSubscriptions.isActive, true)
          )
        )
        .limit(1);

      if (!subscription.length) {
        console.log(`No active weekly subscription for user ${user.id}`);
        return;
      }

      const currentCount = parseInt(subscription[0].weeklyEmailCount || '0');
      if (currentCount >= 12) {
        console.log(`User ${user.id} has already received 12 weekly emails`);
        // Deactivate subscription
        await db
          .update(emailSubscriptions)
          .set({ isActive: false })
          .where(
            and(
              eq(emailSubscriptions.userId, user.id),
              eq(emailSubscriptions.emailType, 'weekly_coaching')
            )
          );
        return;
      }

      const weeklyHtml = this.generateWeeklyCoachingEmailHtml(user, weekNumber);
      const subject = `Week ${weekNumber}: Your Strengths Coaching Insight`;

      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [user.email!],
        subject,
        html: weeklyHtml,
      });

      // Update the weekly email count
      await db
        .update(emailSubscriptions)
        .set({ 
          weeklyEmailCount: (currentCount + 1).toString(),
          isActive: currentCount + 1 < 12 // Deactivate after 12 emails
        })
        .where(
          and(
            eq(emailSubscriptions.userId, user.id),
            eq(emailSubscriptions.emailType, 'weekly_coaching')
          )
        );

      // Log the email attempt
      await db.insert(emailLogs).values({
        userId: user.id,
        emailType: 'weekly_coaching',
        emailSubject: subject,
        weekNumber: weekNumber.toString(),
        resendId: data?.id,
        status: error ? 'failed' : 'sent',
        errorMessage: error?.message,
      });

      if (error) {
        console.error('Failed to send weekly coaching email:', error);
        throw new Error(`Failed to send weekly coaching email: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in sendWeeklyCoachingEmail:', error);
      throw error;
    }
  }

  async processWeeklyEmails(): Promise<void> {
    try {
      // Get all active weekly subscriptions
      const activeSubscriptions = await db
        .select({
          subscription: emailSubscriptions,
          user: users,
        })
        .from(emailSubscriptions)
        .innerJoin(users, eq(emailSubscriptions.userId, users.id))
        .where(
          and(
            eq(emailSubscriptions.emailType, 'weekly_coaching'),
            eq(emailSubscriptions.isActive, true)
          )
        );

      console.log(`Processing ${activeSubscriptions.length} active weekly subscriptions`);

      for (const { subscription, user } of activeSubscriptions) {
        const currentCount = parseInt(subscription.weeklyEmailCount || '0');
        
        if (currentCount < 12) {
          const nextWeek = currentCount + 1;
          await this.sendWeeklyCoachingEmail(user, nextWeek);
          console.log(`Sent week ${nextWeek} email to ${user.email}`);
        }
      }
    } catch (error) {
      console.error('Error processing weekly emails:', error);
    }
  }

  private generateWelcomeEmailHtml(user: User): string {
    const firstName = user.firstName || 'there';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Strengths Manager</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .highlight { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 5px; }
          .cta { text-align: center; margin: 30px 0; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to Strengths Manager! 🎯</h1>
          <p>Transform your strengths data into actionable coaching</p>
        </div>
        
        <div class="content">
          <h2>Hi ${firstName},</h2>
          
          <p>Welcome to Strengths Manager! We're excited to help you unlock your team's potential through strengths-based leadership.</p>
          
          <div class="highlight">
            <strong>What happens next?</strong><br>
            Starting Monday, you'll receive weekly coaching insights delivered straight to your inbox at 9 AM. Each email contains practical, science-backed strategies to help you apply your strengths and engage your team's unique talents.
          </div>
          
          <h3>Here's what you can expect:</h3>
          <ul>
            <li><strong>Week 1-3:</strong> Foundation building - Understanding your strengths ecosystem</li>
            <li><strong>Week 4-6:</strong> Team dynamics - Leveraging collective strengths</li>
            <li><strong>Week 7-9:</strong> Advanced applications - Strengths in challenging situations</li>
            <li><strong>Week 10-12:</strong> Mastery - Becoming a strengths-based leader</li>
          </ul>
          
          <div class="cta">
            <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}" class="button">
              Start Your Strengths Journey
            </a>
          </div>
          
          <p>Remember: "Don't waste time trying to put in what was left out. Try to draw out what was left in." - Marcus Buckingham</p>
        </div>
        
        <div class="footer">
          <p>You're receiving this because you signed up for Strengths Manager.<br>
          Questions? Just reply to this email - we'd love to help!</p>
        </div>
      </body>
      </html>
    `;
  }

  private generateWeeklyCoachingEmailHtml(user: User, weekNumber: number): string {
    const firstName = user.firstName || 'there';
    const weeklyContent = this.getWeeklyContent(weekNumber);
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Week ${weekNumber}: Your Strengths Coaching</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .insight { background: #e7f3ff; padding: 20px; border-left: 4px solid #007bff; margin: 20px 0; border-radius: 5px; }
          .action { background: #f0f9f0; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 5px; }
          .cta { text-align: center; margin: 30px 0; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
          .progress { background: #e9ecef; height: 8px; border-radius: 4px; margin: 20px 0; }
          .progress-bar { background: #007bff; height: 100%; border-radius: 4px; width: ${(weekNumber / 12) * 100}%; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Week ${weekNumber}: ${weeklyContent.title}</h1>
          <div class="progress">
            <div class="progress-bar"></div>
          </div>
          <p>${weekNumber} of 12 weeks complete</p>
        </div>
        
        <div class="content">
          <h2>Hi ${firstName},</h2>
          
          ${weeklyContent.content}
          
          <div class="cta">
            <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/chat-coach" class="button">
              Continue in Strengths Manager
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p>This is email ${weekNumber} of your 12-week strengths journey.<br>
          Questions? Just reply to this email!</p>
        </div>
      </body>
      </html>
    `;
  }

  private getWeeklyContent(weekNumber: number): { title: string; content: string } {
    const weeklyInsights = {
      1: {
        title: "Understanding Your Strengths Foundation",
        content: `
          <p>Welcome to your first week of strengths-based leadership development!</p>
          
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>Your top strengths are not just what you're good at—they're the activities that energize you. When you operate from your strengths, you don't just perform better; you feel more alive and engaged.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Strengths Audit:</strong> Track your energy throughout this week. Notice when you feel most energized and engaged. These moments likely align with your strengths in action.</p>
            <ul>
              <li>Set 3 phone reminders throughout each day</li>
              <li>Rate your energy level (1-10) and note what you were doing</li>
              <li>Look for patterns by Friday</li>
            </ul>
          </div>
          
          <p><strong>Leadership Tip:</strong> Share your top 5 strengths with your team this week. Ask them to do the same. Strengths work best when they're visible and celebrated.</p>
        `
      },
      2: {
        title: "Strengths in Daily Interactions",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>The magic happens when you intentionally apply your strengths to daily interactions. Every conversation is an opportunity to leverage what makes you uniquely effective.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Strengths-Based Conversations:</strong> Before important meetings or conversations, ask yourself: "How can I bring my top strength into this interaction?"</p>
            <ul>
              <li>If you have <em>Strategic</em>, help the team see the bigger picture</li>
              <li>If you have <em>Empathy</em>, focus on understanding others' perspectives</li>
              <li>If you have <em>Achiever</em>, help drive toward concrete outcomes</li>
            </ul>
          </div>
          
          <p><strong>Team Challenge:</strong> Notice and name when you see teammates using their strengths. A simple "I love how your Strategic thinking just helped us see that connection" goes a long way.</p>
        `
      },
      3: {
        title: "Building Your Strengths Partnership",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>The highest-performing teams don't just know their individual strengths—they create intentional partnerships where strengths complement each other.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Partnership Mapping:</strong> Identify one team member whose strengths complement yours. Schedule a "strengths partnership" conversation.</p>
            <p>Discussion questions:</p>
            <ul>
              <li>"What energizes you most in your work?"</li>
              <li>"Where do you see our strengths creating synergy?"</li>
              <li>"What would an ideal collaboration look like between us?"</li>
            </ul>
          </div>
          
          <p><strong>Pro Tip:</strong> The best partnerships happen when you understand not just what someone is good at, but what gives them energy. Focus on energy, not just ability.</p>
        `
      },
      4: {
        title: "Leading Through Your Strengths",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>Authentic leadership flows from your strengths. The most effective leaders don't try to be someone else—they find ways to lead that align with their natural talents.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Strengths-Based Leadership Audit:</strong> Examine your leadership through a strengths lens.</p>
            <ul>
              <li>What leadership activities energize you most?</li>
              <li>When do you feel most authentic as a leader?</li>
              <li>How can you delegate or partner in areas outside your strengths?</li>
            </ul>
          </div>
          
          <p><strong>Remember:</strong> Great leaders aren't well-rounded—they're authentic and surround themselves with people whose strengths complement their own.</p>
        `
      },
      5: {
        title: "Strengths Under Pressure",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>Your strengths don't disappear under pressure—but they might show up differently. Learning to recognize and manage your strengths in challenging times is crucial for sustainable leadership.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Pressure Point Analysis:</strong> Think about a recent stressful situation. How did your top strengths show up? Were they helpful or did they create blind spots?</p>
            <p>Create a "pressure playbook":</p>
            <ul>
              <li>When stressed, my [strength] shows up as...</li>
              <li>This helps me by...</li>
              <li>I need to watch out for...</li>
            </ul>
          </div>
          
          <p><strong>Team Application:</strong> Share your pressure patterns with your team. Create psychological safety by normalizing that everyone's strengths can become overused under stress.</p>
        `
      },
      6: {
        title: "Building a Strengths-Based Team Culture",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>Culture is created through consistent, small actions over time. A strengths-based culture emerges when teams regularly notice, name, and celebrate each other's strengths.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Strengths Spotting Challenge:</strong> Make it a habit to notice and name strengths in action.</p>
            <ul>
              <li>In each team meeting, call out one specific strength you observed</li>
              <li>Start team check-ins with "What strength did you see someone use this week?"</li>
              <li>End conversations with "I appreciated how you brought [specific strength] to this"</li>
            </ul>
          </div>
          
          <p><strong>Cultural Shift:</strong> Move from "fixing weaknesses" to "maximizing strengths." Ask "How can we do more of what's working?" instead of only focusing on what needs to be fixed.</p>
        `
      },
      7: {
        title: "Strengths-Based Problem Solving",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>Every problem is an opportunity to apply strengths in new ways. The most creative solutions often emerge when teams consciously leverage their diverse strengths.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Strengths-First Problem Solving:</strong> For any challenge this week, start by asking:</p>
            <ul>
              <li>"What strengths on our team are most relevant to this problem?"</li>
              <li>"How can we combine our strengths in a new way?"</li>
              <li>"Who should lead based on which strengths this requires?"</li>
            </ul>
          </div>
          
          <p><strong>Insight:</strong> Problems that require strengths you don't have are partnerships waiting to happen. Don't see gaps as limitations—see them as collaboration opportunities.</p>
        `
      },
      8: {
        title: "Strengths-Based Decision Making",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>The best decisions happen when you know which strengths to activate for different types of choices. Some decisions need Strategic thinking, others need Empathy, still others need Activator energy.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Decision Strengths Mapping:</strong> For important decisions this week:</p>
            <ul>
              <li>Identify what type of decision this is (strategic, people-focused, operational, etc.)</li>
              <li>Determine which team strengths are most relevant</li>
              <li>Ensure those voices are heard in the decision process</li>
            </ul>
          </div>
          
          <p><strong>Pro Tip:</strong> Different decisions require different strengths. Make sure you're not defaulting to the same decision-making approach for every situation.</p>
        `
      },
      9: {
        title: "Developing Others Through Strengths",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>The highest impact you can have as a leader is helping others discover and develop their strengths. People grow fastest in their areas of greatest natural talent.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Strengths-Based Development Conversations:</strong> Have one development conversation focused entirely on strengths:</p>
            <ul>
              <li>"What activities give you the most energy?"</li>
              <li>"When do you feel most effective and authentic?"</li>
              <li>"How can we create more opportunities for you to use these strengths?"</li>
            </ul>
          </div>
          
          <p><strong>Mindset Shift:</strong> Instead of asking "How can you improve in this area?" ask "How can you apply your strengths to be even more effective in this area?"</p>
        `
      },
      10: {
        title: "Strengths-Based Change Leadership",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>Change is most successful when it leverages existing strengths rather than requiring people to become someone they're not. Lead change through strengths, not despite them.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Change Through Strengths:</strong> For any change initiative:</p>
            <ul>
              <li>Map team strengths to change requirements</li>
              <li>Assign change roles based on strengths, not just availability</li>
              <li>Communicate how the change allows people to use their strengths more</li>
            </ul>
          </div>
          
          <p><strong>Key Insight:</strong> People resist change when it threatens their ability to be effective. Show them how change enhances their natural talents, and resistance transforms into engagement.</p>
        `
      },
      11: {
        title: "Sustaining Strengths-Based Leadership",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>Strengths-based leadership isn't a program—it's a mindset and a practice. The key to sustainability is building strengths awareness into your regular rhythms and systems.</p>
          </div>
          
          <div class="action">
            <h3>💡 This Week's Action</h3>
            <p><strong>Systems Integration:</strong> Build strengths into your regular practices:</p>
            <ul>
              <li>Add strengths check-ins to team meetings</li>
              <li>Include strengths language in job descriptions and performance reviews</li>
              <li>Create "strengths partnerships" for major projects</li>
            </ul>
          </div>
          
          <p><strong>Long-term Vision:</strong> Imagine your team six months from now, fully operating from their strengths. What would be different? What would that make possible?</p>
        `
      },
      12: {
        title: "Your Strengths Leadership Legacy",
        content: `
          <div class="insight">
            <h3>🎯 This Week's Insight</h3>
            <p>You've completed your 12-week strengths journey! The real work begins now—living these insights every day and creating a ripple effect that extends far beyond your immediate team.</p>
          </div>
          
          <div class="action">
            <h3>💡 Your Ongoing Practice</h3>
            <p><strong>Strengths Leadership Commitment:</strong> Define your ongoing strengths practice:</p>
            <ul>
              <li>What's your personal strengths development goal?</li>
              <li>How will you continue developing others through their strengths?</li>
              <li>What strengths-based changes will you make permanent?</li>
            </ul>
          </div>
          
          <p><strong>Your Legacy:</strong> The greatest leaders don't just achieve results—they develop other leaders. By leading through strengths, you're creating a legacy of authentic, energized leadership that will multiply far beyond your direct influence.</p>
          
          <p><em>Thank you for your commitment to strengths-based leadership. The world needs more leaders like you—leaders who see the best in people and help them become even better.</em></p>
        `
      }
    };

    return weeklyInsights[weekNumber as keyof typeof weeklyInsights] || {
      title: "Your Strengths Journey Continues",
      content: "<p>Keep applying your strengths to create extraordinary results!</p>"
    };
  }
}

export const emailService = new EmailService();