import NoShowService from './NoShowService';

export class NoShowScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  start(intervalMinutes: number = 60): void {
    if (this.intervalId) {
      console.log('⚠️  No-show scheduler is already running');
      return;
    }

    console.log(`⏰ Starting no-show scheduler (checking every ${intervalMinutes} minutes)`);
    
    this.processNoShows().catch(err => 
      console.error('Error in initial no-show processing:', err)
    );

    this.intervalId = setInterval(async () => {
      try {
        await this.processNoShows();
      } catch (error) {
        console.error('Error in no-show scheduler:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 No-show scheduler stopped');
    }
  }

  private async processNoShows(): Promise<void> {
    console.log('🚫 Processing no-show detection...');

    try {
      const { detected, failed } = await NoShowService.processAutoDetection();
      console.log(`🚫 No-show processing complete: ${detected} detected, ${failed} failed`);
    } catch (error) {
      console.error('❌ Error processing no-shows:', error);
    }
  }
}

export default new NoShowScheduler();
