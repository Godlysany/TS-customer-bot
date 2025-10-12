export interface Contact {
  id: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  messageType: 'text' | 'voice' | 'image' | 'file';
  direction: 'inbound' | 'outbound';
  sender: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  contactId: string;
  status: 'active' | 'resolved' | 'escalated';
  assignedAgentId?: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  isActive: boolean;
}

export interface Prompt {
  id: string;
  name: string;
  systemPrompt: string;
  businessContext: string;
  temperature: number;
  model: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  conversationId: string;
  contactId: string;
  calendarEventId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'cancelled';
  metadata?: Record<string, any>;
}

export interface CalendarProvider {
  createEvent(event: CalendarEvent): Promise<string>;
  updateEvent(eventId: string, event: Partial<CalendarEvent>): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  getAvailability(startDate: Date, endDate: Date): Promise<TimeSlot[]>;
}

export interface CalendarEvent {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}
