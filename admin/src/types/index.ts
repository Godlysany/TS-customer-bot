export interface Conversation {
  id: string;
  contactId: string;
  status: 'active' | 'resolved' | 'escalated';
  lastMessageAt: Date;
  createdAt: Date;
  contact?: Contact;
  messageCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  content: string;
  messageType: 'text' | 'voice' | 'image';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  approvalStatus?: 'pending_approval' | 'sending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  intent?: string;
}

export interface Contact {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  lastInteractionAt?: Date;
  createdAt: Date;
}

export interface Setting {
  key: string;
  value: string;
  category: string;
  isSecret: boolean;
  updatedAt: Date;
}

export interface CustomerAnalytics {
  contactId: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  keywords: string[];
  upsellPotential: 'high' | 'medium' | 'low';
  appointmentHistory: number;
  lastEngagementScore: number;
  updatedAt: Date;
}

export interface ConversationTakeover {
  id: string;
  conversationId: string;
  agentId: string;
  mode: 'pause_bot' | 'write_between' | 'full_control';
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  filterCriteria: any;
  message: string;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  scheduledFor?: Date;
  createdAt: Date;
}

export interface Booking {
  id: string;
  contactId: string;
  conversationId: string;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'completed' | 'cancelled' | 'confirmed' | 'pending' | 'no_show';
  googleEventId?: string;
  createdAt: Date;
  // Multi-session fields
  isPartOfMultiSession?: boolean;
  sessionGroupId?: string;
  sessionNumber?: number;
  totalSessions?: number;
  // Relations
  contact?: any;
  services?: any;
  title?: string;
}

export interface Prompt {
  id: string;
  name: string;
  systemPrompt: string;
  businessContext?: string;
  temperature: number;
  isActive: boolean;
  createdAt: Date;
}
