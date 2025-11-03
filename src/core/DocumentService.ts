import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import { sendProactiveMessage } from '../adapters/whatsapp';
import { EmailService } from './EmailService';
import { AIService } from './AIService';

export interface ServiceDocument {
  id: string;
  serviceId: string;
  name: string;
  description?: string;
  fileUrl?: string;
  documentType: 'pdf' | 'image' | 'link' | 'text';
  sendTiming: 'pre_booking' | 'post_booking' | 'pre_appointment' | 'post_appointment';
  isRequired: boolean;
  orderPosition: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDelivery {
  id: string;
  bookingId: string;
  documentId: string;
  contactId: string;
  deliveryMethod: 'email' | 'whatsapp' | 'both';
  status: 'pending' | 'sent' | 'failed' | 'acknowledged';
  sentAt?: string;
  acknowledgedAt?: string;
  metadata?: any;
}

export class DocumentService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  async getDocumentsForService(serviceId: string): Promise<ServiceDocument[]> {
    const { data, error } = await supabase
      .from('service_documents')
      .select('*')
      .eq('service_id', serviceId)
      .order('order_position', { ascending: true });

    if (error) throw error;
    return data ? data.map(d => toCamelCase(d) as ServiceDocument) : [];
  }

  async createDocument(document: Partial<ServiceDocument>): Promise<ServiceDocument> {
    const { data, error } = await supabase
      .from('service_documents')
      .insert(toSnakeCase(document))
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(data) as ServiceDocument;
  }

  async updateDocument(id: string, updates: Partial<ServiceDocument>): Promise<ServiceDocument> {
    const { data, error } = await supabase
      .from('service_documents')
      .update(toSnakeCase(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(data) as ServiceDocument;
  }

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase
      .from('service_documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deliverDocumentsForBooking(
    bookingId: string,
    timing: 'pre_booking' | 'post_booking' | 'pre_appointment' | 'post_appointment'
  ): Promise<{ sent: number; failed: number }> {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, service_id, contact_id, title, start_time, contacts(phone_number, email, name)')
      .eq('id', bookingId)
      .single();

    if (!booking || !booking.service_id) {
      return { sent: 0, failed: 0 };
    }

    const documents = await this.getDocumentsForService(booking.service_id);
    const timingDocs = documents.filter(doc => doc.sendTiming === timing);

    if (timingDocs.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const { data: existingDeliveries } = await supabase
      .from('document_deliveries')
      .select('document_id, status')
      .eq('booking_id', bookingId)
      .in('document_id', timingDocs.map(d => d.id))
      .in('status', ['sent', 'acknowledged']);

    const alreadySentDocIds = new Set(existingDeliveries?.map(d => d.document_id) || []);
    const docsToSend = timingDocs.filter(doc => !alreadySentDocIds.has(doc.id));

    if (docsToSend.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const doc of docsToSend) {
      let deliveryMethod: 'email' | 'whatsapp' | 'both' = 'whatsapp';
      try {
        const contact = booking.contacts as any;
        deliveryMethod = this.determineDeliveryMethod(contact);

        if (deliveryMethod === 'whatsapp' || deliveryMethod === 'both') {
          await this.sendViaWhatsApp(
            contact.phone_number,
            booking.contact_id,
            doc,
            booking.title,
            timing
          );
        }

        if (deliveryMethod === 'email' || deliveryMethod === 'both') {
          await this.sendViaEmail(
            contact.email,
            contact.name,
            doc,
            booking.title,
            timing
          );
        }

        await this.trackDelivery(bookingId, doc.id, booking.contact_id, deliveryMethod, 'sent');
        sent++;
      } catch (error) {
        console.error(`Failed to deliver document ${doc.id}:`, error);
        await this.trackDelivery(bookingId, doc.id, booking.contact_id, deliveryMethod, 'failed');
        failed++;
      }
    }

    return { sent, failed };
  }

  private determineDeliveryMethod(contact: any): 'email' | 'whatsapp' | 'both' {
    const hasEmail = contact?.email && contact.email.length > 0;
    const hasPhone = contact?.phone_number && contact.phone_number.length > 0;

    if (hasEmail && hasPhone) return 'both';
    if (hasEmail) return 'email';
    if (hasPhone) return 'whatsapp';
    return 'whatsapp';
  }

  private async sendViaWhatsApp(
    phoneNumber: string,
    contactId: string,
    doc: ServiceDocument,
    bookingTitle: string,
    timing: string
  ): Promise<void> {
    const timingText = timing === 'pre_booking' ? 'before your appointment' :
                      timing === 'post_booking' ? 'after booking' :
                      timing === 'pre_appointment' ? 'before your appointment' :
                      'after your appointment';

    // Build template message
    let templateMessage = `📄 *${doc.name}*\n\n`;
    
    if (doc.description) {
      templateMessage += `${doc.description}\n\n`;
    }

    if (doc.documentType === 'text') {
      templateMessage += `${doc.fileUrl || ''}\n\n`;
    } else if (doc.fileUrl) {
      templateMessage += `📎 Document: ${doc.fileUrl}\n\n`;
    }

    templateMessage += `This is for your ${bookingTitle} appointment (${timingText}).`;

    if (doc.isRequired) {
      templateMessage += `\n\n⚠️ Please review this ${doc.documentType === 'text' ? 'information' : 'document'} - it's required for your appointment.`;
    }

    // Personalize through GPT for natural, language-appropriate delivery
    const aiService = new AIService();
    const personalizedMessage = await aiService.personalizeMessage({
      templateMessage,
      contactId,
      conversationContext: `Sending ${doc.documentType} document for ${bookingTitle} appointment (${timingText})`,
      messageType: 'general',
    });

    await sendProactiveMessage(phoneNumber, personalizedMessage, contactId);
  }

  private async sendViaEmail(
    email: string,
    name: string,
    doc: ServiceDocument,
    bookingTitle: string,
    timing: string
  ): Promise<void> {
    const timingText = timing === 'pre_booking' ? 'Before Your Appointment' :
                      timing === 'post_booking' ? 'After Booking' :
                      timing === 'pre_appointment' ? 'Before Your Appointment' :
                      'After Your Appointment';

    const subject = `${doc.name} - ${timingText}`;
    
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${doc.name}</h2>
        <p>Dear ${name},</p>
    `;

    if (doc.description) {
      html += `<p>${doc.description}</p>`;
    }

    if (doc.documentType === 'text' && doc.fileUrl) {
      html += `<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        ${doc.fileUrl}
      </div>`;
    } else if (doc.fileUrl) {
      html += `<p><a href="${doc.fileUrl}" style="display: inline-block; background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Download ${doc.documentType.toUpperCase()}
      </a></p>`;
    }

    html += `<p>This is for your <strong>${bookingTitle}</strong> appointment.</p>`;

    if (doc.isRequired) {
      html += `<p style="color: #EF4444;"><strong>⚠️ Important:</strong> Please review this ${doc.documentType === 'text' ? 'information' : 'document'} - it's required for your appointment.</p>`;
    }

    html += `
        <p>Best regards,<br>Your Service Team</p>
      </div>
    `;

    await this.emailService.sendEmail({
      to: email,
      subject,
      html,
      emailType: 'reminder',
    });
  }

  private async trackDelivery(
    bookingId: string,
    documentId: string,
    contactId: string,
    deliveryMethod: 'email' | 'whatsapp' | 'both',
    status: 'pending' | 'sent' | 'failed' | 'acknowledged'
  ): Promise<void> {
    const { error } = await supabase
      .from('document_deliveries')
      .insert({
        booking_id: bookingId,
        document_id: documentId,
        contact_id: contactId,
        delivery_method: deliveryMethod,
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      });

    if (error && !error.message.includes('does not exist')) {
      console.error('Error tracking document delivery:', error);
    }
  }

  async scheduleDocumentDelivery(bookingId: string): Promise<void> {
    await this.deliverDocumentsForBooking(bookingId, 'pre_booking');
    await this.deliverDocumentsForBooking(bookingId, 'post_booking');
  }

  async processPostAppointmentDocuments(bookingId: string): Promise<void> {
    await this.deliverDocumentsForBooking(bookingId, 'post_appointment');
  }

  async processCompletedAppointmentDocuments(): Promise<{ sent: number; failed: number }> {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: completedBookings } = await supabase
      .from('bookings')
      .select('id, service_id, end_time')
      .eq('status', 'confirmed')
      .gte('end_time', yesterday.toISOString())
      .lt('end_time', now.toISOString())
      .not('service_id', 'is', null);

    if (!completedBookings || completedBookings.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const booking of completedBookings) {
      const { sent, failed } = await this.deliverDocumentsForBooking(
        booking.id,
        'post_appointment'
      );
      totalSent += sent;
      totalFailed += failed;
    }

    return { sent: totalSent, failed: totalFailed };
  }

  async processPreAppointmentDocuments(): Promise<{ sent: number; failed: number }> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const { data: upcomingBookings } = await supabase
      .from('bookings')
      .select('id, service_id')
      .eq('status', 'confirmed')
      .gte('start_time', tomorrow.toISOString())
      .lt('start_time', dayAfter.toISOString())
      .not('service_id', 'is', null);

    if (!upcomingBookings || upcomingBookings.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const booking of upcomingBookings) {
      const { sent, failed } = await this.deliverDocumentsForBooking(
        booking.id,
        'pre_appointment'
      );
      totalSent += sent;
      totalFailed += failed;
    }

    return { sent: totalSent, failed: totalFailed };
  }
}

export default new DocumentService();
