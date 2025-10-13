"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderScheduler = exports.ReminderScheduler = void 0;
const ReminderService_1 = require("./ReminderService");
class ReminderScheduler {
    reminderService;
    intervalId = null;
    isRunning = false;
    constructor() {
        this.reminderService = new ReminderService_1.ReminderService();
    }
    /**
     * Start the reminder scheduler
     * Checks for pending reminders every 5 minutes
     */
    start(intervalMinutes = 5) {
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
    stop() {
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
    async processReminders() {
        try {
            console.log('📨 Processing pending reminders...');
            const result = await this.reminderService.processPendingReminders();
            if (result.sent > 0 || result.failed > 0) {
                console.log(`📨 Reminder batch complete: ${result.sent} sent, ${result.failed} failed`);
            }
        }
        catch (error) {
            console.error('❌ Error processing reminders:', error);
        }
    }
    /**
     * Manually trigger reminder processing
     */
    async triggerNow() {
        console.log('📨 Manually triggering reminder processing...');
        return await this.reminderService.processPendingReminders();
    }
}
exports.ReminderScheduler = ReminderScheduler;
// Export singleton instance
exports.reminderScheduler = new ReminderScheduler();
