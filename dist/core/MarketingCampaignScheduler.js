"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMarketingCampaignScheduler = startMarketingCampaignScheduler;
exports.stopMarketingCampaignScheduler = stopMarketingCampaignScheduler;
const MarketingCampaignExecutor_1 = __importDefault(require("./MarketingCampaignExecutor"));
let schedulerInterval = null;
function startMarketingCampaignScheduler(intervalMinutes = 60) {
    if (schedulerInterval) {
        console.log('⚠️  Marketing campaign scheduler already running');
        return;
    }
    console.log(`📧 Starting marketing campaign scheduler (every ${intervalMinutes} minutes)`);
    // Process immediately on start
    MarketingCampaignExecutor_1.default.processCampaigns().catch((err) => {
        console.error('Error in marketing campaign scheduler:', err);
    });
    // Then schedule regular intervals
    schedulerInterval = setInterval(() => {
        MarketingCampaignExecutor_1.default.processCampaigns().catch((err) => {
            console.error('Error in marketing campaign scheduler:', err);
        });
    }, intervalMinutes * 60 * 1000);
}
function stopMarketingCampaignScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('📧 Marketing campaign scheduler stopped');
    }
}
