import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { settingsApi } from '../lib/api';

interface FeatureVisibility {
  showQuestionnaires: boolean;
  showCampaigns: boolean;
  showPromotions: boolean;
  showBirthdayWishes: boolean;
  showTestimonials: boolean;
  showDocuments: boolean;
  showRecurring: boolean;
  showBookings: boolean;
  showNurturing: boolean; // True if ANY nurturing feature is visible
  isLoading: boolean;
}

/**
 * Hook to determine feature visibility based on user role and bot config flags
 * 
 * RULE: Master role ALWAYS sees all features regardless of flags
 * RULE: Support/Operator roles only see enabled features
 */
export const useFeatureVisibility = (): FeatureVisibility => {
  const { agent } = useAuth();
  const isMaster = agent?.role === 'master';

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'bot_config'],
    queryFn: async () => {
      const res = await settingsApi.getAll('bot_config');
      return res.data;
    },
  });

  // Helper to get boolean setting value
  const getSetting = (key: string, defaultValue: boolean = true): boolean => {
    const setting = settings?.find((s: any) => s.key === key);
    if (!setting?.value) return defaultValue;
    return setting.value === 'true' || setting.value === true;
  };

  // If master, always show everything
  if (isMaster) {
    return {
      showQuestionnaires: true,
      showCampaigns: true,
      showPromotions: true,
      showBirthdayWishes: true,
      showTestimonials: true,
      showDocuments: true,
      showRecurring: true,
      showBookings: true,
      showNurturing: true,
      isLoading,
    };
  }

  // For non-master roles, check feature flags
  const showQuestionnaires = getSetting('enable_questionnaires', true);
  const showCampaigns = getSetting('enable_campaigns', true);
  const showPromotions = getSetting('enable_promotions', true);
  const showBirthdayWishes = getSetting('enable_birthday_wishes', true);
  const showTestimonials = getSetting('enable_testimonials', true);
  const showDocuments = getSetting('enable_service_documents', true);
  const showRecurring = getSetting('enable_recurring_reminders', true);
  const showBookings = getSetting('enable_booking', true);

  // Show Nurturing page if at least one nurturing feature is enabled
  const showNurturing = 
    showQuestionnaires || 
    showCampaigns || 
    showPromotions || 
    showBirthdayWishes || 
    showTestimonials || 
    showDocuments || 
    showRecurring;

  return {
    showQuestionnaires,
    showCampaigns,
    showPromotions,
    showBirthdayWishes,
    showTestimonials,
    showDocuments,
    showRecurring,
    showBookings,
    showNurturing,
    isLoading,
  };
};
