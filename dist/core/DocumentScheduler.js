"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentScheduler = void 0;
const DocumentService_1 = require("./DocumentService");
class DocumentScheduler {
    documentService;
    intervalId = null;
    constructor() {
        this.documentService = new DocumentService_1.DocumentService();
    }
    start(intervalMinutes = 60) {
        if (this.intervalId) {
            console.log('⚠️  Document scheduler is already running');
            return;
        }
        console.log(`⏰ Starting document scheduler (checking every ${intervalMinutes} minutes)`);
        this.processDocuments().catch(err => console.error('Error in initial document processing:', err));
        this.intervalId = setInterval(async () => {
            try {
                await this.processDocuments();
            }
            catch (error) {
                console.error('Error in document scheduler:', error);
            }
        }, intervalMinutes * 60 * 1000);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🛑 Document scheduler stopped');
        }
    }
    async processDocuments() {
        console.log('📄 Processing scheduled document deliveries...');
        try {
            const preResults = await this.documentService.processPreAppointmentDocuments();
            console.log(`📄 Pre-appointment documents: ${preResults.sent} sent, ${preResults.failed} failed`);
            const postResults = await this.documentService.processCompletedAppointmentDocuments();
            console.log(`📄 Post-appointment documents: ${postResults.sent} sent, ${postResults.failed} failed`);
            const totalSent = preResults.sent + postResults.sent;
            const totalFailed = preResults.failed + postResults.failed;
            console.log(`📄 Total document processing: ${totalSent} sent, ${totalFailed} failed`);
        }
        catch (error) {
            console.error('❌ Error processing documents:', error);
        }
    }
}
exports.DocumentScheduler = DocumentScheduler;
exports.default = new DocumentScheduler();
