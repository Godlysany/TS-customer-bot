"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BirthdayScheduler = void 0;
const supabase_1 = require("../infrastructure/supabase");
const whatsapp_1 = require("../adapters/whatsapp");
const AIService_1 = require("./AIService");
const NurturingService_1 = require("./NurturingService");
class BirthdayScheduler {
    nurturingService;
    intervalId = null;
    constructor() {
        this.nurturingService = new NurturingService_1.NurturingService();
    }
    start(intervalMinutes = 1440) {
        if (this.intervalId) {
            console.log('⚠️  Birthday scheduler is already running');
            return;
        }
        console.log(`⏰ Starting birthday scheduler (checking every ${intervalMinutes} minutes)`);
        this.processBirthdayWishes().catch(err => console.error('Error in initial birthday processing:', err));
        this.intervalId = setInterval(async () => {
            try {
                await this.processBirthdayWishes();
            }
            catch (error) {
                console.error('Error in birthday scheduler:', error);
            }
        }, intervalMinutes * 60 * 1000);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🛑 Birthday scheduler stopped');
        }
    }
    async processBirthdayWishes() {
        console.log('🎂 Processing birthday wishes...');
        const results = {
            sent: 0,
            failed: 0,
        };
        try {
            // Check if birthday wishes are enabled
            const enabled = await this.nurturingService.getSetting('birthday_wish_enabled');
            if (enabled !== 'true') {
                console.log('🎂 Birthday wishes disabled - skipping');
                return results;
            }
            // Get contacts with birthdays today
            const birthdayContacts = await this.nurturingService.getBirthdayContactsToday();
            if (birthdayContacts.length === 0) {
                console.log('🎂 No birthdays today');
                return results;
            }
            console.log(`🎂 Found ${birthdayContacts.length} birthday(s) today`);
            // Get settings
            const messageTemplate = await this.nurturingService.getSetting('birthday_message_template') ||
                'Happy Birthday {{name}}! 🎉 Wishing you a wonderful day filled with joy and happiness!';
            const enablePromotion = await this.nurturingService.getSetting('birthday_enable_promotion') === 'true';
            const promotionId = await this.nurturingService.getSetting('birthday_promotion_id') || undefined;
            // Process each birthday contact
            for (const contact of birthdayContacts) {
                try {
                    await this.sendBirthdayWish(contact, messageTemplate, enablePromotion, promotionId);
                    results.sent++;
                }
                catch (error) {
                    console.error(`❌ Failed to send birthday wish to ${contact.name}:`, error.message);
                    results.failed++;
                }
            }
            console.log(`🎂 Birthday processing complete: ${results.sent} sent, ${results.failed} failed`);
        }
        catch (error) {
            console.error('❌ Error in birthday scheduler:', error);
        }
        return results;
    }
    async sendBirthdayWish(contact, messageTemplate, enablePromotion, promotionId) {
        if (!contact.phone_number) {
            throw new Error('No phone number');
        }
        // Calculate age if birthdate is complete
        let age;
        if (contact.birthdate) {
            const birthYear = new Date(contact.birthdate).getFullYear();
            const currentYear = new Date().getFullYear();
            if (birthYear > 1900) { // Valid birth year
                age = currentYear - birthYear;
            }
        }
        // Build template message with placeholders
        let templateMessage = messageTemplate
            .replace(/\{\{name\}\}/g, contact.name || 'there')
            .replace(/\{\{age\}\}/g, age ? age.toString() : '');
        // Add promotion message if enabled
        let promotionDetails = null;
        if (enablePromotion && promotionId) {
            const { data: promotion } = await supabase_1.supabase
                .from('promotions')
                .select('*')
                .eq('id', promotionId)
                .single();
            if (promotion) {
                promotionDetails = promotion;
                const discount = promotion.discount_type === 'percentage'
                    ? `${promotion.discount_value}%`
                    : `CHF ${promotion.discount_value}`;
                templateMessage += `\n\n🎁 Special Birthday Gift: ${promotion.name} - ${discount} off!\n${promotion.description || ''}`;
                // Create promotion usage record
                await supabase_1.supabase.from('promotion_usage').insert({
                    promotion_id: promotionId,
                    contact_id: contact.id,
                    usage_date: new Date().toISOString(),
                    discount_amount: 0, // Will be calculated when used
                    booking_id: null,
                    campaign_id: null,
                    metadata: { birthday_gift: true },
                });
            }
        }
        // Personalize through GPT for natural, language-appropriate delivery
        const aiService = new AIService_1.AIService();
        const personalizedMessage = await aiService.personalizeMessage({
            templateMessage,
            contactId: contact.id,
            contactName: contact.name,
            conversationContext: `Customer's birthday today${age ? `, turning ${age}` : ''}${promotionDetails ? '. Sending birthday promotion gift' : ''}`,
            messageType: 'general',
        });
        // Send birthday message
        await (0, whatsapp_1.sendProactiveMessage)(contact.phone_number, personalizedMessage, contact.id);
        // Log activity
        await this.nurturingService.logActivity({
            contactId: contact.id,
            activityType: 'birthday_wish',
            status: 'sent',
            messageContent: personalizedMessage,
            metadata: {
                has_promotion: enablePromotion && !!promotionId,
                promotion_id: promotionId,
                age: age,
            },
        });
        // Update contact's last birthday message timestamp
        await supabase_1.supabase
            .from('contacts')
            .update({ last_birthday_message_at: new Date().toISOString() })
            .eq('id', contact.id);
        console.log(`🎂 ✅ Sent birthday wish to ${contact.name}`);
    }
}
exports.BirthdayScheduler = BirthdayScheduler;
exports.default = new BirthdayScheduler();
