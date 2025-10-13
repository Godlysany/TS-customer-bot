import { DocumentService } from './DocumentService';

export class DocumentScheduler {
  private documentService: DocumentService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.documentService = new DocumentService();
  }

  start(intervalMinutes: number = 60): void {
    if (this.intervalId) {
      console.log('⚠️  Document scheduler is already running');
      return;
    }

    console.log(`⏰ Starting document scheduler (checking every ${intervalMinutes} minutes)`);
    
    this.processDocuments().catch(err => 
      console.error('Error in initial document processing:', err)
    );

    this.intervalId = setInterval(async () => {
      try {
        await this.processDocuments();
      } catch (error) {
        console.error('Error in document scheduler:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Document scheduler stopped');
    }
  }

  private async processDocuments(): Promise<void> {
    console.log('📄 Processing scheduled document deliveries...');

    try {
      const preResults = await this.documentService.processPreAppointmentDocuments();
      console.log(`📄 Pre-appointment documents: ${preResults.sent} sent, ${preResults.failed} failed`);

      const postResults = await this.documentService.processCompletedAppointmentDocuments();
      console.log(`📄 Post-appointment documents: ${postResults.sent} sent, ${postResults.failed} failed`);

      const totalSent = preResults.sent + postResults.sent;
      const totalFailed = preResults.failed + postResults.failed;
      console.log(`📄 Total document processing: ${totalSent} sent, ${totalFailed} failed`);
    } catch (error) {
      console.error('❌ Error processing documents:', error);
    }
  }
}

export default new DocumentScheduler();
