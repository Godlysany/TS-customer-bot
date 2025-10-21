/**
 * CRM Data Extraction Types
 * 
 * Types for storing and managing customer insights extracted from conversations
 */

export interface CommunicationPreferences {
  whatsappOnly?: boolean;
  emailPreferred?: boolean;
  callPreferred?: boolean;
  bestTimeToContact?: string; // e.g., "mornings", "afternoons", "weekdays only"
  doNotContact?: boolean;
  preferredLanguage?: string;
}

export interface CustomerInsights {
  // Booking Preferences
  preferredTimes?: string;           // "mornings", "weekends", "Mondays at 2pm"
  preferredStaff?: string;           // "Dr. Schmidt", "Sarah the hygienist"
  preferredServices?: string;        // Services they typically book or express interest in
  
  // Health & Safety
  fearsAnxieties?: string;           // "dental anxiety", "needle phobia", "claustrophobia"
  allergies?: string;                // "latex allergy", "penicillin sensitivity"
  physicalLimitations?: string;      // "wheelchair access needed", "hearing impaired", "vision issues"
  
  // Special Needs
  specialRequests?: string;          // "quiet environment", "bring companion", "child-friendly"
  communicationPreferences?: CommunicationPreferences;
  
  // Behavioral Patterns
  behavioralNotes?: string;          // "always early", "tends to cancel last-minute", "very detail-oriented"
  
  // General Insights
  customerInsights?: string;         // Free-form notes about customer preferences, personality, etc.
}

export interface ContactCRMData {
  id: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  preferredLanguage?: string;
  
  // CRM Data (from conversation extraction)
  preferredTimes?: string;
  preferredStaff?: string;
  preferredServices?: string;
  fearsAnxieties?: string;
  allergies?: string;
  physicalLimitations?: string;
  specialRequests?: string;
  communicationPreferences?: CommunicationPreferences | string; // JSONB in DB
  behavioralNotes?: string;
  customerInsights?: string;
  
  // Metadata
  notes?: string;
  tags?: string[];
  source?: 'whatsapp' | 'manual' | 'csv_import';
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Data extracted from a single conversation
 */
export interface ExtractedConversationData {
  // What was learned in this conversation
  newInsights?: {
    preferredTimes?: string;
    preferredStaff?: string;
    preferredServices?: string;
    fearsAnxieties?: string;
    allergies?: string;
    physicalLimitations?: string;
    specialRequests?: string;
    behavioralNotes?: string;
    other?: string;
  };
  
  // Confidence level of extraction
  confidence?: number; // 0-1
  
  // When this data was extracted
  extractedAt?: Date;
  
  // Which conversation it came from
  conversationId?: string;
}

export default {
  CommunicationPreferences,
  CustomerInsights,
  ContactCRMData,
  ExtractedConversationData,
};
