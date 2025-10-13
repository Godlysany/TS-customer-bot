"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoShowScheduler = void 0;
const NoShowService_1 = __importDefault(require("./NoShowService"));
class NoShowScheduler {
    intervalId = null;
    start(intervalMinutes = 60) {
        if (this.intervalId) {
            console.log('⚠️  No-show scheduler is already running');
            return;
        }
        console.log(`⏰ Starting no-show scheduler (checking every ${intervalMinutes} minutes)`);
        this.processNoShows().catch(err => console.error('Error in initial no-show processing:', err));
        this.intervalId = setInterval(async () => {
            try {
                await this.processNoShows();
            }
            catch (error) {
                console.error('Error in no-show scheduler:', error);
            }
        }, intervalMinutes * 60 * 1000);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🛑 No-show scheduler stopped');
        }
    }
    async processNoShows() {
        console.log('🚫 Processing no-show detection...');
        try {
            const { detected, failed } = await NoShowService_1.default.processAutoDetection();
            console.log(`🚫 No-show processing complete: ${detected} detected, ${failed} failed`);
        }
        catch (error) {
            console.error('❌ Error processing no-shows:', error);
        }
    }
}
exports.NoShowScheduler = NoShowScheduler;
exports.default = new NoShowScheduler();
