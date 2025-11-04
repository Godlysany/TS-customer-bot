import { AIService } from '../AIService';

/**
 * Service Detection Tests - Testing Production Code
 * 
 * Tests the ACTUAL service detection logic used in production
 * to prevent hallucinations and ensure accurate service matching.
 * 
 * This test suite exercises the real detectServiceFromMessage() method
 * to prevent regression in the hallucination-prevention system.
 */

describe('AIService.detectServiceFromMessage() - Production Logic Tests', () => {
  const aiService = new AIService();

  // Mock services that might exist in a typical B2B setup
  const mockServices = [
    { id: '1', name: 'Deep Tissue Massage' },
    { id: '2', name: 'Physical Therapy' },
    { id: '3', name: 'Acupuncture' },
    { id: '4', name: 'Dental Cleaning' },
    { id: '5', name: 'Root Canal Treatment' },
    { id: '6', name: 'Consultation' },
    { id: '7', name: 'Hair Styling Service' },
    { id: '8', name: 'Facial Treatment' },
  ];

  /**
   * Test intent entity priority (highest priority)
   */
  describe('Intent Entity Priority (Highest)', () => {
    it('should use intent entity when available', () => {
      const message = 'I want a massage';
      const entities = { service: 'Deep Tissue Massage' };
      
      const result = aiService.detectServiceFromMessage(message, mockServices, entities);
      
      expect(result.service).toBeDefined();
      expect(result.service?.name).toBe('Deep Tissue Massage');
      expect(result.method).toBe('intent_entity');
    });

    it('should prioritize intent entity over message content', () => {
      const message = 'I need physical therapy';
      const entities = { service: 'Acupuncture' }; // Different from message
      
      const result = aiService.detectServiceFromMessage(message, mockServices, entities);
      
      expect(result.service?.name).toBe('Acupuncture'); // Should use entity, not message
      expect(result.method).toBe('intent_entity');
    });

    it('should fall back to message detection if entity does not match', () => {
      const message = 'I need Deep Tissue Massage';
      const entities = { service: 'Nonexistent Service' };
      
      const result = aiService.detectServiceFromMessage(message, mockServices, entities);
      
      expect(result.service?.name).toBe('Deep Tissue Massage');
      expect(result.method).toBe('exact_match'); // Fell back to message detection
    });
  });

  /**
   * Test exact matches (second priority)
   */
  describe('Exact Service Name Matches', () => {
    it('should detect exact service name match', () => {
      const message = 'I would like to book a Deep Tissue Massage';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service).toBeDefined();
      expect(result.service?.name).toBe('Deep Tissue Massage');
      expect(result.method).toBe('exact_match');
    });

    it('should detect exact match case-insensitively', () => {
      const message = 'CAN I SCHEDULE PHYSICAL THERAPY?';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service?.name).toBe('Physical Therapy');
      expect(result.method).toBe('exact_match');
    });

    it('should detect exact match in middle of sentence', () => {
      const message = 'My dentist said I need a root canal treatment soon';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service?.name).toBe('Root Canal Treatment');
      expect(result.method).toBe('exact_match');
    });
  });

  /**
   * Test multi-word partial matches
   */
  describe('Multi-Word Partial Matches (Tightened Logic)', () => {
    it('should detect when 2+ distinctive words match', () => {
      const message = 'I need a root canal';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service?.name).toBe('Root Canal Treatment');
      expect(result.method).toBe('multi_word_match');
    });

    it('should detect "tissue massage" matches "Deep Tissue Massage"', () => {
      const message = 'Do you offer tissue massage appointments?';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service?.name).toBe('Deep Tissue Massage');
      expect(result.method).toBe('multi_word_match');
    });

    it('should detect "dental cleaning" matches "Dental Cleaning"', () => {
      const message = 'I want a dental cleaning session';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service?.name).toBe('Dental Cleaning');
      expect(result.method).toBe('multi_word_match');
    });
  });

  /**
   * Test single distinctive word matches
   */
  describe('Single Distinctive Word Matches', () => {
    it('should detect "Acupuncture" from single distinctive word', () => {
      const message = 'I want acupuncture';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service?.name).toBe('Acupuncture');
      expect(result.method).toBe('single_word_match');
    });

    it('should detect "Consultation" from single distinctive word', () => {
      const message = 'Can I book a consultation?';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service?.name).toBe('Consultation');
      expect(result.method).toBe('single_word_match');
    });
  });

  /**
   * Test stopwords filtering (CRITICAL for hallucination prevention)
   */
  describe('Stopwords Filtering - False Positive Prevention', () => {
    it('should NOT match on generic word "therapy" alone', () => {
      const message = 'I need therapy for my stress';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      // Should NOT match Physical Therapy because "therapy" is a stopword
      expect(result.service).toBeNull();
      expect(result.method).toBe('none');
    });

    it('should NOT match on generic word "treatment" alone', () => {
      const message = 'What treatment do you recommend?';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service).toBeNull();
      expect(result.method).toBe('none');
    });

    it('should NOT match on generic "service" alone', () => {
      const message = 'What service options do you have?';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service).toBeNull();
      expect(result.method).toBe('none');
    });

    it('should NOT match when only one word of multi-word service matches', () => {
      const message = 'I need deep cleaning for my house';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      // Should NOT match "Dental Cleaning" because only "cleaning" matches
      // and it requires 2+ words for multi-word services
      expect(result.service).toBeNull();
      expect(result.method).toBe('none');
    });
  });

  /**
   * Test edge cases
   */
  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      const result = aiService.detectServiceFromMessage('', mockServices);
      
      expect(result.service).toBeNull();
      expect(result.method).toBe('none');
    });

    it('should handle message with no service mention', () => {
      const result = aiService.detectServiceFromMessage('Hello, how are you?', mockServices);
      
      expect(result.service).toBeNull();
      expect(result.method).toBe('none');
    });

    it('should handle empty services array', () => {
      const result = aiService.detectServiceFromMessage('I need a massage', []);
      
      expect(result.service).toBeNull();
      expect(result.method).toBe('none');
    });

    it('should be case-insensitive', () => {
      const message = 'I NEED A DEEP TISSUE MASSAGE!!!';
      
      const result = aiService.detectServiceFromMessage(message, mockServices);
      
      expect(result.service?.name).toBe('Deep Tissue Massage');
      expect(result.method).toBe('exact_match');
    });
  });

  /**
   * Test detection method accuracy
   */
  describe('Detection Method Accuracy', () => {
    it('should return "intent_entity" for entity matches', () => {
      const result = aiService.detectServiceFromMessage(
        'massage',
        mockServices,
        { service: 'Deep Tissue Massage' }
      );
      
      expect(result.method).toBe('intent_entity');
    });

    it('should return "exact_match" for full name in message', () => {
      const result = aiService.detectServiceFromMessage(
        'I want Deep Tissue Massage',
        mockServices
      );
      
      expect(result.method).toBe('exact_match');
    });

    it('should return "multi_word_match" for 2+ words', () => {
      const result = aiService.detectServiceFromMessage(
        'tissue massage please',
        mockServices
      );
      
      expect(result.method).toBe('multi_word_match');
    });

    it('should return "single_word_match" for single distinctive word', () => {
      const result = aiService.detectServiceFromMessage(
        'acupuncture appointment',
        mockServices
      );
      
      expect(result.method).toBe('single_word_match');
    });

    it('should return "none" when no match found', () => {
      const result = aiService.detectServiceFromMessage(
        'random unrelated text',
        mockServices
      );
      
      expect(result.method).toBe('none');
    });
  });

  /**
   * Performance tests
   */
  describe('Performance', () => {
    it('should detect service quickly even with many services', () => {
      const largeServiceList = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        name: `Service ${i}`,
      }));
      largeServiceList.push({ id: '999', name: 'Deep Tissue Massage' });

      const startTime = Date.now();
      const result = aiService.detectServiceFromMessage(
        'Book deep tissue massage',
        largeServiceList
      );
      const endTime = Date.now();

      expect(result.service).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10); // Should be < 10ms
    });

    it('should handle intent entity lookup efficiently', () => {
      const largeServiceList = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        name: `Service ${i}`,
      }));
      largeServiceList.push({ id: '999', name: 'Target Service' });

      const startTime = Date.now();
      const result = aiService.detectServiceFromMessage(
        'some message',
        largeServiceList,
        { service: 'Target Service' }
      );
      const endTime = Date.now();

      expect(result.service?.name).toBe('Target Service');
      expect(result.method).toBe('intent_entity');
      expect(endTime - startTime).toBeLessThan(5); // Intent entity should be even faster
    });
  });
});
