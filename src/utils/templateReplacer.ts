/**
 * Template Placeholder Replacement Utility
 * 
 * Replaces placeholders in templates with actual data
 * Supports: {{name}}, {{service}}, {{datetime}}, {{date}}, {{time}}, 
 *           {{cost}}, {{location}}, {{directions}}, {{business_name}}
 */

export interface TemplateData {
  name?: string;
  service?: string;
  datetime?: Date | string;
  date?: string;
  time?: string;
  cost?: number | string;
  location?: string;
  directions?: string;
  businessName?: string;
  // Additional fields
  email?: string;
  phoneNumber?: string;
  discountCode?: string;
  discountAmount?: number | string;
  promoVoucher?: string;
  cancellationReason?: string;
  penaltyFee?: number | string;
  reviewLink?: string;
}

/**
 * Replace placeholders in a template string with actual data
 * @param template - Template string with {{placeholders}}
 * @param data - Data object containing replacement values
 * @returns Processed template with placeholders replaced
 */
export function replacePlaceholders(template: string, data: TemplateData): string {
  if (!template) return '';

  let result = template;

  // Helper function to format date/time
  const formatDateTime = (dt: Date | string | undefined): { date: string; time: string; datetime: string } => {
    if (!dt) return { date: '', time: '', datetime: '' };
    
    const dateObj = typeof dt === 'string' ? new Date(dt) : dt;
    
    const date = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const time = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const datetime = `${date} at ${time}`;

    return { date, time, datetime };
  };

  const formatted = formatDateTime(data.datetime);

  // Define all placeholder replacements
  const replacements: Record<string, string> = {
    '{{name}}': data.name || 'Customer',
    '{{service}}': data.service || 'Service',
    '{{datetime}}': formatted.datetime || data.datetime?.toString() || '',
    '{{date}}': data.date || formatted.date,
    '{{time}}': data.time || formatted.time,
    '{{cost}}': data.cost !== undefined ? `CHF ${data.cost}` : '',
    '{{location}}': data.location || '',
    '{{directions}}': data.directions || '',
    '{{business_name}}': data.businessName || '',
    '{{email}}': data.email || '',
    '{{phone_number}}': data.phoneNumber || '',
    '{{discount_code}}': data.discountCode || '',
    '{{discount_amount}}': data.discountAmount !== undefined ? `CHF ${data.discountAmount}` : '',
    '{{promo_voucher}}': data.promoVoucher || '',
    '{{cancellation_reason}}': data.cancellationReason || '',
    '{{penalty_fee}}': data.penaltyFee !== undefined ? `CHF ${data.penaltyFee}` : '',
    '{{review_link}}': data.reviewLink || '',
  };

  // Replace all placeholders (case-insensitive)
  for (const [placeholder, value] of Object.entries(replacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'gi');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Extract placeholders from a template
 * @param template - Template string
 * @returns Array of placeholder names found
 */
export function extractPlaceholders(template: string): string[] {
  if (!template) return [];
  
  const regex = /\{\{([^}]+)\}\}/g;
  const placeholders: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    placeholders.push(match[1].trim());
  }

  return [...new Set(placeholders)]; // Remove duplicates
}

/**
 * Validate that all required placeholders are present in data
 * @param template - Template string
 * @param data - Data object
 * @returns Array of missing placeholders
 */
export function validateTemplateData(template: string, data: TemplateData): string[] {
  const placeholders = extractPlaceholders(template);
  const missing: string[] = [];

  const dataKeys = new Set([
    'name', 'service', 'datetime', 'date', 'time', 'cost',
    'location', 'directions', 'businessName', 'email', 'phoneNumber',
    'discountCode', 'discountAmount', 'promoVoucher', 'cancellationReason',
    'penaltyFee', 'reviewLink'
  ]);

  for (const placeholder of placeholders) {
    const key = placeholder.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (!dataKeys.has(key) && !data[key as keyof TemplateData]) {
      missing.push(placeholder);
    }
  }

  return missing;
}

/**
 * Replace placeholders with safe fallbacks (never show empty placeholders to users)
 * @param template - Template string
 * @param data - Data object
 * @returns Processed template with fallbacks for missing data
 */
export function replacePlaceholdersWithFallback(template: string, data: TemplateData): string {
  let result = replacePlaceholders(template, data);

  // Replace any remaining unreplaced placeholders with safe fallbacks
  const fallbacks: Record<string, string> = {
    '{{name}}': 'Customer',
    '{{service}}': 'Service',
    '{{datetime}}': 'your appointment time',
    '{{date}}': 'the scheduled date',
    '{{time}}': 'the scheduled time',
    '{{cost}}': 'the service cost',
    '{{location}}': 'our location',
    '{{directions}}': 'contact us for directions',
    '{{business_name}}': 'our team',
  };

  for (const [placeholder, fallback] of Object.entries(fallbacks)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'gi');
    result = result.replace(regex, fallback);
  }

  return result;
}

export default {
  replacePlaceholders,
  replacePlaceholdersWithFallback,
  extractPlaceholders,
  validateTemplateData,
};
