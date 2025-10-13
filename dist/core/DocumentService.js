"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const whatsapp_1 = require("../adapters/whatsapp");
const EmailService_1 = require("./EmailService");
class DocumentService {
    emailService;
    constructor() {
        this.emailService = new EmailService_1.EmailService();
    }
    async getDocumentsForService(serviceId) {
        const { data, error } = await supabase_1.supabase
            .from('service_documents')
            .select('*')
            .eq('service_id', serviceId)
            .order('order_position', { ascending: true });
        if (error)
            throw error;
        return data ? data.map(d => (0, mapper_1.toCamelCase)(d)) : [];
    }
    async createDocument(document) {
        const { data, error } = await supabase_1.supabase
            .from('service_documents')
            .insert((0, mapper_1.toSnakeCase)(document))
            .select()
            .single();
        if (error)
            throw error;
        return (0, mapper_1.toCamelCase)(data);
    }
    async updateDocument(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from('service_documents')
            .update((0, mapper_1.toSnakeCase)(updates))
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return (0, mapper_1.toCamelCase)(data);
    }
    async deleteDocument(id) {
        const { error } = await supabase_1.supabase
            .from('service_documents')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
    }
    async deliverDocumentsForBooking(bookingId, timing) {
        const { data: booking } = await supabase_1.supabase
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
        let sent = 0;
        let failed = 0;
        for (const doc of timingDocs) {
            try {
                const contact = booking.contacts;
                const deliveryMethod = this.determineDeliveryMethod(contact);
                if (deliveryMethod === 'whatsapp' || deliveryMethod === 'both') {
                    await this.sendViaWhatsApp(contact.phone_number, booking.contact_id, doc, booking.title, timing);
                }
                if (deliveryMethod === 'email' || deliveryMethod === 'both') {
                    await this.sendViaEmail(contact.email, contact.name, doc, booking.title, timing);
                }
                await this.trackDelivery(bookingId, doc.id, booking.contact_id, deliveryMethod, 'sent');
                sent++;
            }
            catch (error) {
                console.error(`Failed to deliver document ${doc.id}:`, error);
                await this.trackDelivery(bookingId, doc.id, booking.contact_id, 'whatsapp', 'failed');
                failed++;
            }
        }
        return { sent, failed };
    }
    determineDeliveryMethod(contact) {
        const hasEmail = contact?.email && contact.email.length > 0;
        const hasPhone = contact?.phone_number && contact.phone_number.length > 0;
        if (hasEmail && hasPhone)
            return 'both';
        if (hasEmail)
            return 'email';
        if (hasPhone)
            return 'whatsapp';
        return 'whatsapp';
    }
    async sendViaWhatsApp(phoneNumber, contactId, doc, bookingTitle, timing) {
        const timingText = timing === 'pre_booking' ? 'before your appointment' :
            timing === 'post_booking' ? 'after booking' :
                timing === 'pre_appointment' ? 'before your appointment' :
                    'after your appointment';
        let message = `📄 *${doc.name}*\n\n`;
        if (doc.description) {
            message += `${doc.description}\n\n`;
        }
        if (doc.documentType === 'text') {
            message += `${doc.fileUrl || ''}\n\n`;
        }
        else if (doc.fileUrl) {
            message += `📎 Document: ${doc.fileUrl}\n\n`;
        }
        message += `This is for your ${bookingTitle} appointment (${timingText}).`;
        if (doc.isRequired) {
            message += `\n\n⚠️ Please review this ${doc.documentType === 'text' ? 'information' : 'document'} - it's required for your appointment.`;
        }
        await (0, whatsapp_1.sendProactiveMessage)(phoneNumber, message, contactId);
    }
    async sendViaEmail(email, name, doc, bookingTitle, timing) {
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
        }
        else if (doc.fileUrl) {
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
    async trackDelivery(bookingId, documentId, contactId, deliveryMethod, status) {
        const { error } = await supabase_1.supabase
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
    async scheduleDocumentDelivery(bookingId) {
        await this.deliverDocumentsForBooking(bookingId, 'pre_booking');
    }
    async processPostAppointmentDocuments(bookingId) {
        await this.deliverDocumentsForBooking(bookingId, 'post_appointment');
    }
    async processPreAppointmentDocuments() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);
        const { data: upcomingBookings } = await supabase_1.supabase
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
            const { sent, failed } = await this.deliverDocumentsForBooking(booking.id, 'pre_appointment');
            totalSent += sent;
            totalFailed += failed;
        }
        return { sent: totalSent, failed: totalFailed };
    }
}
exports.DocumentService = DocumentService;
exports.default = new DocumentService();
