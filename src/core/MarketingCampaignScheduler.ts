import marketingCampaignExecutor from './MarketingCampaignExecutor';

let schedulerInterval: NodeJS.Timeout | null = null;

export function startMarketingCampaignScheduler(intervalMinutes: number = 60) {
  if (schedulerInterval) {
    console.log('⚠️  Marketing campaign scheduler already running');
    return;
  }

  console.log(`📧 Starting marketing campaign scheduler (every ${intervalMinutes} minutes)`);
  
  // Process immediately on start
  marketingCampaignExecutor.processCampaigns().catch((err: any) => {
    console.error('Error in marketing campaign scheduler:', err);
  });

  // Then schedule regular intervals
  schedulerInterval = setInterval(() => {
    marketingCampaignExecutor.processCampaigns().catch((err: any) => {
      console.error('Error in marketing campaign scheduler:', err);
    });
  }, intervalMinutes * 60 * 1000);
}

export function stopMarketingCampaignScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('📧 Marketing campaign scheduler stopped');
  }
}
