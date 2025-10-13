import { ReminderService } from './ReminderService';

export class ReminderScheduler {
  private reminderService: ReminderService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.reminderService = new ReminderService();
  }

  /**
   * Start the reminder scheduler
   * Checks for pending reminders every 5 minutes
   */
  start(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      console.log('⏰ Reminder scheduler already running');
      return;
    }

    console.log(`⏰ Starting reminder scheduler (checking every ${intervalMinutes} minutes)`);
    
    // Process immediately on start
    this.processReminders();

    // Then schedule periodic checks
    this.intervalId = setInterval(() => {
      this.processReminders();
    }, intervalMinutes * 60 * 1000);

    this.isRunning = true;
  }

  /**
   * Stop the reminder scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('⏰ Reminder scheduler stopped');
    }
  }

  /**
   * Process all pending reminders
   */
  private async processReminders(): Promise<void> {
    try {
      console.log('📨 Processing pending reminders...');
      const result = await this.reminderService.processPendingReminders();
      
      if (result.sent > 0 || result.failed > 0) {
        console.log(`📨 Reminder batch complete: ${result.sent} sent, ${result.failed} failed`);
      }
    } catch (error: any) {
      console.error('❌ Error processing reminders:', error);
    }
  }

  /**
   * Manually trigger reminder processing
   */
  async triggerNow(): Promise<{ sent: number; failed: number }> {
    console.log('📨 Manually triggering reminder processing...');
    return await this.reminderService.processPendingReminders();
  }
}

// Export singleton instance
export const reminderScheduler = new ReminderScheduler();
