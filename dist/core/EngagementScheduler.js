"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementScheduler = void 0;
exports.startEngagementScheduler = startEngagementScheduler;
exports.stopEngagementScheduler = stopEngagementScheduler;
exports.getEngagementScheduler = getEngagementScheduler;
const EngagementService_1 = require("./EngagementService");
const SettingsService_1 = require("./SettingsService");
const whatsapp_1 = require("../adapters/whatsapp");
const AIService_1 = require("./AIService");
class EngagementScheduler {
    engagementService;
    settingsService;
    intervalId = null;
    isRunning = false;
    constructor() {
        this.engagementService = new EngagementService_1.EngagementService();
        this.settingsService = new SettingsService_1.SettingsService();
    }
    start(intervalMinutes = 60) {
        if (this.intervalId) {
            console.log('⏰ Engagement scheduler already running');
            return;
        }
        console.log(`⏰ Starting engagement scheduler (checking every ${intervalMinutes} minutes)`);
        this.intervalId = setInterval(() => this.processEngagementCampaigns(), intervalMinutes * 60 * 1000);
        this.processEngagementCampaigns();
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏰ Engagement scheduler stopped');
        }
    }
    async processEngagementCampaigns() {
        if (this.isRunning) {
            console.log('📨 Engagement processing already in progress, skipping...');
            return;
        }
        try {
            this.isRunning = true;
            console.log('📨 Processing proactive engagement campaigns...');
            const engagementEnabled = await this.settingsService.getSetting('proactive_engagement_enabled');
            if (engagementEnabled !== 'true') {
                console.log('⏸️ Proactive engagement is disabled in settings');
                return;
            }
            const campaigns = await this.engagementService.getActiveCampaigns();
            console.log(`📋 Found ${campaigns.length} active engagement campaigns`);
            let totalSent = 0;
            let totalFailed = 0;
            for (const campaign of campaigns) {
                try {
                    console.log(`🎯 Processing campaign: ${campaign.name} (${campaign.campaignType})`);
                    const targets = await this.engagementService.findTargetCustomers(campaign);
                    console.log(`   Found ${targets.length} target customers`);
                    if (targets.length === 0) {
                        continue;
                    }
                    for (const target of targets) {
                        try {
                            // Build template message with placeholders
                            const templateMessage = this.engagementService.formatMessage(campaign.messageTemplate, target);
                            // Personalize through GPT for natural, language-appropriate delivery
                            const aiService = new AIService_1.AIService();
                            const personalizedMessage = await aiService.personalizeMessage({
                                templateMessage,
                                contactId: target.contactId,
                                contactName: target.name,
                                conversationContext: `Nurturing campaign: ${campaign.name}. Last booking: ${target.serviceName || 'N/A'}, ${target.daysSinceLastBooking} days ago`,
                                messageType: 'general',
                            });
                            const success = await (0, whatsapp_1.sendProactiveMessage)(target.phoneNumber, personalizedMessage, target.contactId);
                            if (success) {
                                totalSent++;
                                console.log(`   ✅ Sent to ${target.name || target.phoneNumber}`);
                            }
                            else {
                                totalFailed++;
                                console.log(`   ❌ Failed to send to ${target.name || target.phoneNumber}`);
                            }
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        catch (error) {
                            totalFailed++;
                            console.error(`   ❌ Error sending to ${target.phoneNumber}:`, error);
                        }
                    }
                    await this.engagementService.recordCampaignSent(campaign.id, campaign.totalSent + targets.length);
                }
                catch (error) {
                    console.error(`❌ Error processing campaign ${campaign.name}:`, error);
                }
            }
            console.log(`📨 Engagement processing complete: ${totalSent} sent, ${totalFailed} failed`);
        }
        catch (error) {
            console.error('❌ Error processing engagement campaigns:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    async runOnce() {
        await this.processEngagementCampaigns();
    }
}
exports.EngagementScheduler = EngagementScheduler;
let engagementSchedulerInstance = null;
function startEngagementScheduler(intervalMinutes = 60) {
    if (!engagementSchedulerInstance) {
        engagementSchedulerInstance = new EngagementScheduler();
    }
    engagementSchedulerInstance.start(intervalMinutes);
}
function stopEngagementScheduler() {
    if (engagementSchedulerInstance) {
        engagementSchedulerInstance.stop();
    }
}
function getEngagementScheduler() {
    if (!engagementSchedulerInstance) {
        engagementSchedulerInstance = new EngagementScheduler();
    }
    return engagementSchedulerInstance;
}
