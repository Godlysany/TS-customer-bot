import { RecurringAppointmentService } from './RecurringAppointmentService';

export class RecurringAppointmentScheduler {
  private recurringService: RecurringAppointmentService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.recurringService = new RecurringAppointmentService();
  }

  start(intervalMinutes: number = 1440): void {
    if (this.intervalId) {
      console.log('⏰ Recurring appointment scheduler already running');
      return;
    }

    console.log(
      `⏰ Starting recurring appointment scheduler (checking every ${intervalMinutes} minutes)`
    );

    this.intervalId = setInterval(
      () => this.processRecurringAppointments(),
      intervalMinutes * 60 * 1000
    );

    this.processRecurringAppointments();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏰ Recurring appointment scheduler stopped');
    }
  }

  async processRecurringAppointments(): Promise<void> {
    if (this.isRunning) {
      console.log('📅 Recurring appointment processing already in progress, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('📅 Processing recurring appointments...');

      const result = await this.recurringService.processRecurringAppointments();

      console.log(
        `📅 Recurring processing complete: ${result.created} notifications sent, ${result.failed} failed`
      );
    } catch (error) {
      console.error('❌ Error processing recurring appointments:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async runOnce(): Promise<void> {
    await this.processRecurringAppointments();
  }
}

let recurringSchedulerInstance: RecurringAppointmentScheduler | null = null;

export function startRecurringScheduler(intervalMinutes: number = 1440): void {
  if (!recurringSchedulerInstance) {
    recurringSchedulerInstance = new RecurringAppointmentScheduler();
  }
  recurringSchedulerInstance.start(intervalMinutes);
}

export function stopRecurringScheduler(): void {
  if (recurringSchedulerInstance) {
    recurringSchedulerInstance.stop();
  }
}

export function getRecurringScheduler(): RecurringAppointmentScheduler {
  if (!recurringSchedulerInstance) {
    recurringSchedulerInstance = new RecurringAppointmentScheduler();
  }
  return recurringSchedulerInstance;
}
