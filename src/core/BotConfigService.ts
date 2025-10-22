import { supabase } from '../infrastructure/supabase';
import fs from 'fs';
import path from 'path';

interface BotConfig {
  // Business Details
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  business_location: string;
  business_directions: string;
  opening_hours: string;
  
  // Prompts & Tone
  business_fine_tuning_prompt: string;
  tone_of_voice: string;
  response_style: string;
  
  // Escalation
  escalation_config: {
    mode: string;
    enabled: boolean;
    triggers: {
      keywords: string[];
      sentiment_threshold: number;
    };
    behavior: {
      escalation_message: string;
      notify_agents: boolean;
      pause_bot: boolean;
    };
  };
  
  // Confirmations
  whatsapp_confirmation_enabled: boolean;
  whatsapp_confirmation_template: string;
  email_confirmation_enabled: boolean;
  email_confirmation_subject: string;
  email_confirmation_template: string;
  
  // Service Configuration
  service_trigger_words: Record<string, string[]>;
  service_time_restrictions: Record<string, any>;
  emergency_blocker_slots: Array<{
    id: string;
    start_date: string;
    end_date: string;
    reason: string;
  }>;
  
  // Email Collection
  email_collection_mode: string;
  email_collection_prompt_gentle: string;
  email_collection_prompt_mandatory: string;
  
  // Advanced Controls
  enable_auto_response: boolean;
  enable_booking: boolean;
  enable_questionnaires: boolean;
  enable_promotions: boolean;
  enable_payment_links: boolean;
  enable_crm_extraction: boolean;
  enable_multi_session_booking: boolean;
  confidence_threshold: number;
  require_approval_low_confidence: boolean;
  max_auto_discount_chf: number;
  fallback_message: string;
  escalate_on_uncertainty: boolean;
  max_response_length: number;
  response_delay_ms: number;
  enable_typing_indicator: boolean;
  block_inappropriate_requests: boolean;
  require_human_review_topics: string;
  
  // Language Configuration
  default_bot_language: string;
  supported_languages: string;
  auto_detect_language: boolean;
}

export class BotConfigService {
  private cachedConfig: BotConfig | null = null;
  private lastFetch: number = 0;
  private cacheDuration = 60000; // 1 minute cache

  async getConfig(): Promise<BotConfig> {
    // Return cached config if fresh
    if (this.cachedConfig && Date.now() - this.lastFetch < this.cacheDuration) {
      return this.cachedConfig;
    }

    console.log('📋 Loading bot configuration from database...');

    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('category', 'bot_config');

    if (error) {
      console.error('❌ Failed to load bot config:', error);
      throw new Error('Failed to load bot configuration');
    }

    const getSetting = (key: string, defaultValue: any = ''): any => {
      const setting = settings?.find((s: any) => s.key === key);
      if (!setting?.value) return defaultValue;

      // Handle boolean values
      if (typeof defaultValue === 'boolean') {
        return setting.value === 'true' || setting.value === true;
      }

      // Handle numbers
      if (typeof defaultValue === 'number') {
        return parseFloat(setting.value) || defaultValue;
      }

      // Handle JSON objects
      if (typeof defaultValue === 'object') {
        try {
          return typeof setting.value === 'string' 
            ? JSON.parse(setting.value) 
            : setting.value;
        } catch {
          return defaultValue;
        }
      }

      return setting.value;
    };

    this.cachedConfig = {
      // Business Details
      business_name: getSetting('business_name', 'Our Business'),
      business_address: getSetting('business_address', ''),
      business_phone: getSetting('business_phone', ''),
      business_email: getSetting('business_email', ''),
      business_location: getSetting('business_location', ''),
      business_directions: getSetting('business_directions', ''),
      opening_hours: getSetting('opening_hours', 'Monday-Friday: 09:00-18:00'),
      
      // Prompts & Tone
      business_fine_tuning_prompt: getSetting('business_fine_tuning_prompt', ''),
      tone_of_voice: getSetting('tone_of_voice', 'professional'),
      response_style: getSetting('response_style', 'concise'),
      
      // Escalation
      escalation_config: getSetting('escalation_config', {
        mode: 'sentiment_and_keyword',
        enabled: true,
        triggers: {
          keywords: ['complaint', 'refund', 'angry'],
          sentiment_threshold: -0.3,
        },
        behavior: {
          escalation_message: "I understand this is important. Let me connect you with our team right away.",
          notify_agents: true,
          pause_bot: true,
        },
      }),
      
      // Confirmations
      whatsapp_confirmation_enabled: getSetting('whatsapp_confirmation_enabled', true),
      whatsapp_confirmation_template: getSetting('whatsapp_confirmation_template', 
        '✅ Booking Confirmed!\n\nHi {{name}}, your appointment is confirmed.\n\n📅 Service: {{service}}\n🕐 Date & Time: {{datetime}}\n💰 Cost: CHF {{cost}}\n📍 Location: {{location}}\n\n{{directions}}\n\nSee you soon!\n{{business_name}}'),
      email_confirmation_enabled: getSetting('email_confirmation_enabled', true),
      email_confirmation_subject: getSetting('email_confirmation_subject', 
        'Booking Confirmation - {{service}} on {{date}}'),
      email_confirmation_template: getSetting('email_confirmation_template', 
        'Dear {{name}},\n\nYour appointment has been confirmed.\n\nService: {{service}}\nDate & Time: {{datetime}}\nCost: CHF {{cost}}\nLocation: {{location}}\n\n{{directions}}\n\nBest regards,\n{{business_name}}'),
      
      // Service Configuration
      service_trigger_words: getSetting('service_trigger_words', {}),
      service_time_restrictions: getSetting('service_time_restrictions', {}),
      emergency_blocker_slots: getSetting('emergency_blocker_slots', []),
      
      // Email Collection
      email_collection_mode: getSetting('email_collection_mode', 'gentle'),
      email_collection_prompt_gentle: getSetting('email_collection_prompt_gentle', 
        'By the way, could I have your email address? This helps us send you appointment confirmations and reminders. (It\'s okay if you\'d prefer not to share it)'),
      email_collection_prompt_mandatory: getSetting('email_collection_prompt_mandatory', 
        'To complete your booking, I\'ll need your email address for confirmation and appointment reminders. Could you please share it?'),
      
      // Advanced Controls
      enable_auto_response: getSetting('enable_auto_response', true),
      enable_booking: getSetting('enable_booking', true),
      enable_questionnaires: getSetting('enable_questionnaires', true),
      enable_promotions: getSetting('enable_promotions', true),
      enable_payment_links: getSetting('enable_payment_links', true),
      enable_crm_extraction: getSetting('enable_crm_extraction', true),
      enable_multi_session_booking: getSetting('enable_multi_session_booking', true),
      confidence_threshold: getSetting('confidence_threshold', 0.7),
      require_approval_low_confidence: getSetting('require_approval_low_confidence', true),
      max_auto_discount_chf: getSetting('max_auto_discount_chf', 20),
      fallback_message: getSetting('fallback_message', 
        "I'm not entirely sure I understood that correctly. Let me connect you with our team who can help you better."),
      escalate_on_uncertainty: getSetting('escalate_on_uncertainty', true),
      max_response_length: getSetting('max_response_length', 500),
      response_delay_ms: getSetting('response_delay_ms', 1000),
      enable_typing_indicator: getSetting('enable_typing_indicator', true),
      block_inappropriate_requests: getSetting('block_inappropriate_requests', true),
      require_human_review_topics: getSetting('require_human_review_topics', 'refunds, complaints, cancellations'),
      
      // Language Configuration
      default_bot_language: getSetting('default_bot_language', 'de'),
      supported_languages: getSetting('supported_languages', '["de","en","fr","it","es","pt"]'),
      auto_detect_language: getSetting('auto_detect_language', false),
    };

    this.lastFetch = Date.now();
    console.log('✅ Bot configuration loaded successfully');

    return this.cachedConfig;
  }

  async buildSystemPrompt(contactLanguage?: string | null): Promise<string> {
    const config = await this.getConfig();
    
    // Load Master System Prompt
    const masterPromptPath = path.join(process.cwd(), 'MASTER_SYSTEM_PROMPT.md');
    let masterPrompt = fs.readFileSync(masterPromptPath, 'utf-8');

    // Determine active language for this conversation
    const defaultLang = config.default_bot_language || 'de';
    const customerPreferredLang = contactLanguage || 'Not set (will use default)';
    const activeLang = contactLanguage || defaultLang;
    
    const languageNames: Record<string, string> = {
      de: 'German (Deutsch)',
      en: 'English',
      fr: 'French (Français)',
      it: 'Italian (Italiano)',
      es: 'Spanish (Español)',
      pt: 'Portuguese (Português)',
    };

    // Replace placeholders with actual business details
    const placeholders = {
      '{BUSINESS_NAME}': config.business_name,
      '{OPENING_HOURS}': config.opening_hours,
      '{LOCATION}': config.business_location,
      '{DIRECTIONS}': config.business_directions,
      '{BUSINESS_ADDRESS}': config.business_address,
      '{BUSINESS_PHONE}': config.business_phone,
      '{BUSINESS_EMAIL}': config.business_email,
      '{SERVICE_TRIGGER_WORDS}': JSON.stringify(config.service_trigger_words, null, 2),
      '{SERVICE_RESTRICTIONS}': JSON.stringify(config.service_time_restrictions, null, 2),
      '{EMERGENCY_BLOCKER_SLOTS}': JSON.stringify(config.emergency_blocker_slots, null, 2),
      '{EMAIL_REQUIREMENT_INSTRUCTION}': this.getEmailInstruction(config),
      '{AVAILABLE_SERVICES}': this.getAvailableServices(config),
      '{TEAM_MEMBERS_LIST}': '(Team member configuration to be implemented)',
      '{CUSTOMER_PREFERRED_TEAM_MEMBERS}': '(Customer preferences extracted from CRM)',
      
      // Language context placeholders
      '{DEFAULT_BOT_LANGUAGE}': `${languageNames[defaultLang] || defaultLang} (${defaultLang})`,
      '{CUSTOMER_PREFERRED_LANGUAGE}': customerPreferredLang === 'Not set (will use default)' ? customerPreferredLang : `${languageNames[contactLanguage as string] || contactLanguage} (${contactLanguage})`,
      '{ACTIVE_LANGUAGE}': `${languageNames[activeLang] || activeLang} (${activeLang})`,
    };

    for (const [placeholder, value] of Object.entries(placeholders)) {
      masterPrompt = masterPrompt.replace(new RegExp(placeholder, 'g'), value);
    }

    // Add Business Fine-Tuning Prompt if configured
    let finalPrompt = masterPrompt;
    if (config.business_fine_tuning_prompt) {
      finalPrompt += '\n\n---\n\n## BUSINESS-SPECIFIC PERSONALITY & TONE\n\n';
      finalPrompt += config.business_fine_tuning_prompt;
    }

    // Add tone and style instructions
    finalPrompt += `\n\n---\n\n## RESPONSE STYLE GUIDELINES\n\n`;
    finalPrompt += `- **Tone**: ${this.getToneInstruction(config.tone_of_voice)}\n`;
    finalPrompt += `- **Response Length**: ${this.getStyleInstruction(config.response_style)}\n`;
    finalPrompt += `- **Max Characters**: Keep responses under ${config.max_response_length} characters\n`;

    return finalPrompt;
  }

  private getEmailInstruction(config: BotConfig): string {
    switch (config.email_collection_mode) {
      case 'mandatory':
        return `(REQUIRED - Must collect before booking. Prompt: "${config.email_collection_prompt_mandatory}")`;
      case 'gentle':
        return `(Optional but encouraged. Prompt: "${config.email_collection_prompt_gentle}")`;
      case 'skip':
        return '(Do not ask for email)';
      default:
        return '(Optional)';
    }
  }

  private getAvailableServices(config: BotConfig): string {
    const services = Object.keys(config.service_trigger_words);
    return services.length > 0 ? services.join(', ') : 'All services available';
  }

  private getToneInstruction(tone: string): string {
    const tones: Record<string, string> = {
      professional: 'Professional and formal. Use respectful language and maintain business etiquette.',
      friendly: 'Friendly and casual. Be warm and approachable while remaining helpful.',
      empathetic: 'Empathetic and caring. Show understanding and compassion for customer concerns.',
      concise: 'Direct and concise. Get to the point quickly without unnecessary details.',
      enthusiastic: 'Enthusiastic and energetic. Show excitement and positivity in responses.',
    };
    return tones[tone] || tones.professional;
  }

  private getStyleInstruction(style: string): string {
    const styles: Record<string, string> = {
      concise: '1-2 sentences. Be brief and to the point.',
      balanced: '2-4 sentences. Provide clear but not overly detailed responses.',
      detailed: 'Full explanations with comprehensive details when appropriate.',
    };
    return styles[style] || styles.concise;
  }

  clearCache() {
    this.cachedConfig = null;
    this.lastFetch = 0;
    console.log('🔄 Bot configuration cache cleared');
  }
}

export default new BotConfigService();
