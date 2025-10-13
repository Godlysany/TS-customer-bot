"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecurringAppointmentScheduler = void 0;
exports.startRecurringScheduler = startRecurringScheduler;
exports.stopRecurringScheduler = stopRecurringScheduler;
exports.getRecurringScheduler = getRecurringScheduler;
const RecurringAppointmentService_1 = require("./RecurringAppointmentService");
class RecurringAppointmentScheduler {
    recurringService;
    intervalId = null;
    isRunning = false;
    constructor() {
        this.recurringService = new RecurringAppointmentService_1.RecurringAppointmentService();
    }
    start(intervalMinutes = 1440) {
        if (this.intervalId) {
            console.log('⏰ Recurring appointment scheduler already running');
            return;
        }
        console.log(`⏰ Starting recurring appointment scheduler (checking every ${intervalMinutes} minutes)`);
        this.intervalId = setInterval(() => this.processRecurringAppointments(), intervalMinutes * 60 * 1000);
        this.processRecurringAppointments();
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏰ Recurring appointment scheduler stopped');
        }
    }
    async processRecurringAppointments() {
        if (this.isRunning) {
            console.log('📅 Recurring appointment processing already in progress, skipping...');
            return;
        }
        try {
            this.isRunning = true;
            console.log('📅 Processing recurring appointments...');
            const result = await this.recurringService.processRecurringAppointments();
            console.log(`📅 Recurring processing complete: ${result.created} notifications sent, ${result.failed} failed`);
        }
        catch (error) {
            console.error('❌ Error processing recurring appointments:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    async runOnce() {
        await this.processRecurringAppointments();
    }
}
exports.RecurringAppointmentScheduler = RecurringAppointmentScheduler;
let recurringSchedulerInstance = null;
function startRecurringScheduler(intervalMinutes = 1440) {
    if (!recurringSchedulerInstance) {
        recurringSchedulerInstance = new RecurringAppointmentScheduler();
    }
    recurringSchedulerInstance.start(intervalMinutes);
}
function stopRecurringScheduler() {
    if (recurringSchedulerInstance) {
        recurringSchedulerInstance.stop();
    }
}
function getRecurringScheduler() {
    if (!recurringSchedulerInstance) {
        recurringSchedulerInstance = new RecurringAppointmentScheduler();
    }
    return recurringSchedulerInstance;
}
