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
      console.error('Error processing weekly emails:', error);
    }
  }

  private getTimezonesAt9AM(currentUTCHour: number): string[] {
    // Map of timezones to their UTC offsets (simplified)
    const timezoneOffsets: Record<string, number> = {
      'America/New_York': -5,    // EST (winter)
      'America/Chicago': -6,     // CST (winter)
      'America/Denver': -7,      // MST (winter)
      'America/Los_Angeles': -8, // PST (winter)
      'Europe/London': 0,        // GMT (winter)
      'Europe/Paris': 1,         // CET (winter)
      'Asia/Tokyo': 9,           // JST
      'Australia/Sydney': 11,    // AEDT (summer)
    };

    const targetTimezones: string[] = [];
    
    for (const [timezone, offset] of Object.entries(timezoneOffsets)) {
      // Calculate what hour it is in this timezone
      const localHour = (currentUTCHour + offset + 24) % 24;
      
      // If it's 9 AM in this timezone, include it
      if (localHour === 9) {
        targetTimezones.push(timezone);
      }
    }

    return targetTimezones;
  }

  async sendWelcomeEmail(userId: string, userEmail: string, firstName?: string, timezone: string = 'America/New_York'): Promise<void> {
    try {
      // Create a user object for the email service
      const user = {
        id: userId,
        email: userEmail,
        firstName: firstName || 'there',
      };

      await emailService.sendWelcomeEmail(user as any, timezone);
      console.log(`Welcome email scheduled for ${userEmail}`);
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }

  stop(): void {
    console.log('Stopping email scheduler...');
    this.scheduledJobs.forEach((job, jobId) => {
      job.stop();
      console.log(`Stopped scheduled job: ${jobId}`);
    });
    this.scheduledJobs.clear();
  }
}

export const emailScheduler = new EmailScheduler();