import {
  replacePlaceholders,
  replacePlaceholdersWithFallback,
  extractPlaceholders,
  validateTemplateData,
  TemplateData,
} from '../templateReplacer';

describe('Template Replacer', () => {
  describe('replacePlaceholders', () => {
    it('should replace basic placeholders', () => {
      const template = 'Hello {{name}}, your {{service}} is confirmed.';
      const data: TemplateData = {
        name: 'John Doe',
        service: 'Dental Cleaning',
      };

      const result = replacePlaceholders(template, data);
      expect(result).toBe('Hello John Doe, your Dental Cleaning is confirmed.');
    });

    it('should format datetime correctly', () => {
      const template = 'Your appointment is on {{date}} at {{time}}.';
      const data: TemplateData = {
        datetime: new Date('2025-10-21T14:30:00'),
      };

      const result = replacePlaceholders(template, data);
      expect(result).toContain('Tuesday, October 21, 2025');
      expect(result).toContain('02:30 PM');
    });

    it('should format cost with CHF currency', () => {
      const template = 'Total cost: {{cost}}';
      const data: TemplateData = {
        cost: 150,
      };

      const result = replacePlaceholders(template, data);
      expect(result).toBe('Total cost: CHF 150');
    });

    it('should handle missing data gracefully', () => {
      const template = 'Hello {{name}}, service: {{service}}';
      const data: TemplateData = {
        name: 'John',
      };

      const result = replacePlaceholders(template, data);
      expect(result).toContain('Hello John');
      expect(result).toContain('service: Service'); // Default fallback
    });
  });

  describe('extractPlaceholders', () => {
    it('should extract all placeholders from template', () => {
      const template = 'Hello {{name}}, your {{service}} on {{date}} costs {{cost}}.';
      const placeholders = extractPlaceholders(template);

      expect(placeholders).toEqual(['name', 'service', 'date', 'cost']);
    });

    it('should remove duplicate placeholders', () => {
      const template = '{{name}} {{name}} {{service}}';
      const placeholders = extractPlaceholders(template);

      expect(placeholders).toEqual(['name', 'service']);
    });
  });

  describe('replacePlaceholdersWithFallback', () => {
    it('should use fallbacks for empty placeholders', () => {
      const template = 'Hello {{name}}, visit {{location}}.';
      const data: TemplateData = {};

      const result = replacePlaceholdersWithFallback(template, data);
      expect(result).toBe('Hello Customer, visit our location.');
    });
  });

  describe('Full confirmation template example', () => {
    it('should process complete booking confirmation', () => {
      const template = `✅ Booking Confirmed!

Hi {{name}}, your appointment is confirmed.

📅 Service: {{service}}
🕐 Date & Time: {{datetime}}
💰 Cost: {{cost}}
📍 Location: {{location}}

{{directions}}

See you soon!
{{business_name}}`;

      const data: TemplateData = {
        name: 'Sarah Miller',
        service: 'Root Canal Treatment',
        datetime: new Date('2025-11-15T10:00:00'),
        cost: 450,
        location: '123 Dental Street, Zurich',
        directions: 'Parking available in the rear. Use main entrance.',
        businessName: 'Smile Dental Clinic',
      };

      const result = replacePlaceholders(template, data);

      expect(result).toContain('Sarah Miller');
      expect(result).toContain('Root Canal Treatment');
      expect(result).toContain('CHF 450');
      expect(result).toContain('123 Dental Street, Zurich');
      expect(result).toContain('Smile Dental Clinic');
      expect(result).toContain('Parking available');
    });
  });
});
