import { EngagementService } from './EngagementService';
import { SettingsService } from './SettingsService';
import { sendProactiveMessage } from '../adapters/whatsapp';
import { AIService } from './AIService';

export class EngagementScheduler {
  private engagementService: EngagementService;
  private settingsService: SettingsService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.engagementService = new EngagementService();
    this.settingsService = new SettingsService();
  }

  start(intervalMinutes: number = 60): void {
    if (this.intervalId) {
      console.log('⏰ Engagement scheduler already running');
      return;
    }

    console.log(`⏰ Starting engagement scheduler (checking every ${intervalMinutes} minutes)`);

    this.intervalId = setInterval(
      () => this.processEngagementCampaigns(),
      intervalMinutes * 60 * 1000
    );

    this.processEngagementCampaigns();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏰ Engagement scheduler stopped');
    }
  }

  async processEngagementCampaigns(): Promise<void> {
    if (this.isRunning) {
      console.log('📨 Engagement processing already in progress, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('📨 Processing proactive engagement campaigns...');

      const engagementEnabled = await this.settingsService.getSetting(
        'proactive_engagement_enabled'
      );

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
              const templateMessage = this.engagementService.formatMessage(
                campaign.messageTemplate,
                target
              );

              // Personalize through GPT for natural, language-appropriate delivery
              const aiService = new AIService();
              const personalizedMessage = await aiService.personalizeMessage({
                templateMessage,
                contactId: target.contactId,
                contactName: target.name,
                conversationContext: `Nurturing campaign: ${campaign.name}. Last booking: ${target.serviceName || 'N/A'}, ${target.daysSinceLastBooking} days ago`,
                messageType: 'general',
              });

              const success = await sendProactiveMessage(
                target.phoneNumber,
                personalizedMessage,
                target.contactId
              );

              if (success) {
                totalSent++;
                console.log(`   ✅ Sent to ${target.name || target.phoneNumber}`);
              } else {
                totalFailed++;
                console.log(`   ❌ Failed to send to ${target.name || target.phoneNumber}`);
              }

              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              totalFailed++;
              console.error(`   ❌ Error sending to ${target.phoneNumber}:`, error);
            }
          }

          await this.engagementService.recordCampaignSent(
            campaign.id,
            campaign.totalSent + targets.length
          );
        } catch (error) {
          console.error(`❌ Error processing campaign ${campaign.name}:`, error);
        }
      }

      console.log(`📨 Engagement processing complete: ${totalSent} sent, ${totalFailed} failed`);
    } catch (error) {
      console.error('❌ Error processing engagement campaigns:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async runOnce(): Promise<void> {
    await this.processEngagementCampaigns();
  }
}

let engagementSchedulerInstance: EngagementScheduler | null = null;

export function startEngagementScheduler(intervalMinutes: number = 60): void {
  if (!engagementSchedulerInstance) {
    engagementSchedulerInstance = new EngagementScheduler();
  }
  engagementSchedulerInstance.start(intervalMinutes);
}

export function stopEngagementScheduler(): void {
  if (engagementSchedulerInstance) {
    engagementSchedulerInstance.stop();
  }
}

export function getEngagementScheduler(): EngagementScheduler {
  if (!engagementSchedulerInstance) {
    engagementSchedulerInstance = new EngagementScheduler();
  }
  return engagementSchedulerInstance;
}
