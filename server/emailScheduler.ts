import * as cron from 'node-cron';
import { DateTime } from 'luxon';
import { and, eq, lt, gt } from 'drizzle-orm';
import { EmailService } from './emailService';
import { db } from './db';
import { emailSubscriptions, emailLogs, emailMetrics, users } from '../shared/schema';
import type { EmailSubscription, User } from '../shared/schema';

interface EmailMetricsData {
  totalAttempted: number;
  succeeded: number;
  failed: number;
  timezoneBreakdown: Record<string, number>;
}

export class EmailScheduler {
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private readonly BATCH_SIZE = 50;
  private readonly MAX_RETRIES = 3;
  private emailService: EmailService;
  private metrics: EmailMetricsData = {
    totalAttempted: 0,
    succeeded: 0,
    failed: 0,
    timezoneBreakdown: {}
  };

  constructor() {
    this.emailService = new EmailService();
  }

  init(): void {
    // Run every 5 minutes to check for due emails
    this.scheduledJobs.set('processEmails', cron.schedule('*/5 * * * *', async () => {
      console.log('Processing scheduled emails...');
      await this.processScheduledEmails();
    }));

    // Reset metrics daily at midnight UTC
    this.scheduledJobs.set('resetMetrics', cron.schedule('0 0 * * *', () => {
      this.saveAndResetMetrics();
    }));

    // Retry failed emails every hour
    this.scheduledJobs.set('retryFailed', cron.schedule('0 * * * *', async () => {
      await this.retryFailedEmails();
    }));

    // Retry failed welcome emails every hour
    this.scheduledJobs.set('retryFailedWelcome', cron.schedule('15 * * * *', async () => {
      await this.retryFailedWelcomeEmails();
    }));

    console.log('Email scheduler initialized');
  }

  private async processScheduledEmails(): Promise<void> {
    try {
      let processed = 0;
      
      while (true) {
        // Get next batch of due subscriptions
        const dueSubscriptions = await this.getNextDueBatch(processed);
        if (dueSubscriptions.length === 0) break;

        // Process each subscription in parallel with a concurrency limit
        await Promise.all(
          dueSubscriptions.map(sub => this.processSubscription(sub))
        );

        processed += dueSubscriptions.length;
        
        // Add small delay between batches to prevent rate limiting
        if (dueSubscriptions.length === this.BATCH_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          break;
        }
      }

    } catch (error) {
      console.error('Error processing scheduled emails:', error);
    }
  }

  private async getNextDueBatch(offset: number): Promise<EmailSubscription[]> {
    const now = new Date();
    
    return await db
      .select()
      .from(emailSubscriptions)
      .where(
        and(
          eq(emailSubscriptions.isActive, true),
          eq(emailSubscriptions.emailType, 'weekly_coaching'),
          lt(emailSubscriptions.nextScheduledTime, now)
        )
      )
      .limit(this.BATCH_SIZE)
      .offset(offset);
  }

  private async processSubscription(subscription: EmailSubscription): Promise<void> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, subscription.userId))
      .limit(1)
      .then(results => results[0]);

    if (!user || !subscription.timezone) {
      console.error(`User not found or timezone missing for subscription ${subscription.id}`);
      return;
    }

    this.metrics.totalAttempted++;
    this.metrics.timezoneBreakdown[subscription.timezone] = 
      (this.metrics.timezoneBreakdown[subscription.timezone] || 0) + 1;

    try {
      const weekNumber = parseInt(subscription.weeklyEmailCount || '0') + 1;
      await this.sendWithRetry(user, weekNumber, subscription);
      
      // Update subscription
      const nextScheduledTime = this.calculateNextScheduleTime(subscription.timezone);
      await db
        .update(emailSubscriptions)
        .set({
          weeklyEmailCount: weekNumber.toString(),
          nextScheduledTime,
          lastSentAt: new Date(),
          isActive: weekNumber < 12
        })
        .where(eq(emailSubscriptions.id, subscription.id));

      this.metrics.succeeded++;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to process subscription ${subscription.id}:`, error.message);
      } else {
        console.error(`Failed to process subscription ${subscription.id}:`, error);
      }
      this.metrics.failed++;
    }
  }

  private async sendWithRetry(user: User, weekNumber: number, subscription: EmailSubscription, attempt = 1): Promise<void> {
    try {
      await this.emailService.sendWeeklyCoachingEmail(user, weekNumber);
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendWithRetry(user, weekNumber, subscription, attempt + 1);
      }
      
      // Log failed attempt for later retry
      await db.insert(emailLogs).values({
        userId: user.id,
        emailType: 'weekly_coaching',
        emailSubject: `Week ${weekNumber}: Your Strengths Coaching Insight`,
        weekNumber: weekNumber.toString(),
        status: 'retry',
        retryCount: '0',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  private calculateNextScheduleTime(timezone: string): Date {
    const userTime = DateTime.now().setZone(timezone);
    const nextMonday = userTime
      .plus({ days: (8 - userTime.weekday) % 7 }) // Next Monday
      .set({ hour: 9, minute: 0, second: 0, millisecond: 0 }); // 9 AM
    
    return nextMonday.toJSDate();
  }

  private async retryFailedEmails(): Promise<void> {
    try {
      const failedEmails = await db
        .select()
        .from(emailLogs)
        .where(
          and(
            eq(emailLogs.status, 'retry'),
            lt(emailLogs.retryCount, this.MAX_RETRIES.toString())
          )
        );

      for (const email of failedEmails) {
        try {
          const user = await db
            .select()
            .from(users)
            .where(eq(users.id, email.userId))
            .limit(1)
            .then(results => results[0]);

          if (!user) continue;

          await this.emailService.sendWeeklyCoachingEmail(user, parseInt(email.weekNumber || '0'));
          
          // Update log on success
          await db
            .update(emailLogs)
            .set({ status: 'sent', sentAt: new Date() })
            .where(eq(emailLogs.id, email.id));

        } catch (error) {
          // Update retry count
          const retryCount = parseInt(email.retryCount || '0') + 1;
          await db
            .update(emailLogs)
            .set({
              retryCount: retryCount.toString(),
              status: retryCount >= this.MAX_RETRIES ? 'failed' : 'retry',
              errorMessage: error instanceof Error ? error.message : String(error)
            })
            .where(eq(emailLogs.id, email.id));
        }
      }
    } catch (error) {
      console.error('Error retrying failed emails:', error instanceof Error ? error.message : String(error));
    }
  }

  private async retryFailedWelcomeEmails(): Promise<void> {
    try {
      const failedWelcomeEmails = await db
        .select()
        .from(emailLogs)
        .where(
          and(
            eq(emailLogs.status, 'failed'),
            eq(emailLogs.emailType, 'welcome'),
            lt(emailLogs.retryCount, '2')
          )
        );

      for (const email of failedWelcomeEmails) {
        try {
          const user = await db
            .select()
            .from(users)
            .where(eq(users.id, email.userId))
            .limit(1)
            .then(results => results[0]);
          if (!user) continue;

          // Get timezone from subscription
          const subscription = await db
            .select()
            .from(emailSubscriptions)
            .where(eq(emailSubscriptions.userId, email.userId))
            .limit(1)
            .then(results => results[0]);

          const timezone = subscription?.timezone || 'America/New_York';
          await this.emailService.sendWelcomeEmail(user, timezone);
          await db.update(emailLogs).set({ status: 'sent', sentAt: new Date() }).where(eq(emailLogs.id, email.id));
        } catch (error) {
          const retryCount = parseInt(email.retryCount || '0') + 1;
          await db.update(emailLogs).set({
            retryCount: retryCount.toString(),
            status: retryCount >= 2 ? 'failed' : 'retry',
            errorMessage: error instanceof Error ? error.message : String(error)
          }).where(eq(emailLogs.id, email.id));
        }
      }
    } catch (error) {
      console.error('Error retrying failed welcome emails:', error instanceof Error ? error.message : String(error));
    }
  }

  private async saveAndResetMetrics(): Promise<void> {
    try {
      // Save current metrics
      await db.insert(emailMetrics).values({
        totalAttempted: this.metrics.totalAttempted.toString(),
        succeeded: this.metrics.succeeded.toString(),
        failed: this.metrics.failed.toString(),
        timezoneBreakdown: this.metrics.timezoneBreakdown
      });

      // Reset metrics
      this.metrics = {
        totalAttempted: 0,
        succeeded: 0,
        failed: 0,
        timezoneBreakdown: {}
      };
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  async sendWelcomeEmail(userId: string, userEmail: string, firstName?: string | null, timezone: string = 'America/New_York'): Promise<void> {
    try {
      const user: User = {
        id: userId,
        email: userEmail,
        firstName: firstName || null,
        lastName: null,
        profileImageUrl: null,
        hasCompletedOnboarding: true,
        topStrengths: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.emailService.sendWelcomeEmail(user, timezone);
      
      // Set up next scheduled time for weekly emails
      const nextScheduledTime = this.calculateNextScheduleTime(timezone);
      await db
        .update(emailSubscriptions)
        .set({ nextScheduledTime })
        .where(
          and(
            eq(emailSubscriptions.userId, userId),
            eq(emailSubscriptions.emailType, 'weekly_coaching')
          )
        );

      console.log(`Welcome email sent and weekly schedule set for ${userEmail}`);
    } catch (error) {
      console.error('Error sending welcome email:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  stop(): void {
    this.scheduledJobs.forEach((job) => {
      job.stop();
    });
    this.scheduledJobs.clear();
    console.log('Email scheduler stopped');
  }
}

export const emailScheduler = new EmailScheduler();