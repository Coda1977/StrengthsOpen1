import * as cron from 'node-cron';
import { emailService } from './emailService';

export class EmailScheduler {
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  init(): void {
    // Schedule weekly emails to run every Monday at 9 AM in different timezones
    // This runs every hour to check for users in different timezones
    cron.schedule('0 * * * 1', async () => {
      console.log('Checking for weekly emails to send...');
      await this.processWeeklyEmails();
    });

    console.log('Email scheduler initialized');
  }

  private async processWeeklyEmails(): Promise<void> {
    try {
      const currentTime = new Date();
      const currentHour = currentTime.getUTCHours();
      
      // Calculate which timezones are at 9 AM right now
      // This is a simplified approach - in production you'd want more precise timezone handling
      const targetTimezones = this.getTimezonesAt9AM(currentHour);
      
      if (targetTimezones.length > 0) {
        console.log(`Processing weekly emails for timezones: ${targetTimezones.join(', ')}`);
        await emailService.processWeeklyEmails();
      }
    } catch (error) {
      console.error('Error in processWeeklyEmails:', error);
    }
  }

  private getTimezonesAt9AM(currentUTCHour: number): string[] {
    // Map of UTC hour to common timezones that would be at 9 AM
    const timezoneMap: { [key: number]: string[] } = {
      13: ['America/New_York', 'America/Toronto'], // UTC-5 (EST)
      14: ['America/Chicago', 'America/Mexico_City'], // UTC-6 (CST)
      15: ['America/Denver', 'America/Phoenix'], // UTC-7 (MST)
      16: ['America/Los_Angeles', 'America/Vancouver'], // UTC-8 (PST)
      17: ['Pacific/Honolulu'], // UTC-10 (HST)
      1: ['Europe/London', 'Europe/Dublin'], // UTC+0 (GMT)
      8: ['Europe/Berlin', 'Europe/Paris'], // UTC+1 (CET)
      0: ['Asia/Tokyo', 'Asia/Seoul'], // UTC+9 (JST)
      23: ['Australia/Sydney', 'Australia/Melbourne'], // UTC+10 (AEST)
    };

    return timezoneMap[currentUTCHour] || [];
  }

  async sendWelcomeEmail(userId: string, userEmail: string, firstName?: string, timezone: string = 'America/New_York'): Promise<void> {
    try {
      const user = {
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

      await emailService.sendWelcomeEmail(user, timezone);
      console.log(`Welcome email queued for ${userEmail}`);
    } catch (error) {
      console.error('Error sending welcome email:', error);
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