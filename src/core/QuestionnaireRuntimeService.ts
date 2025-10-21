import { Questionnaire, Question } from './QuestionnaireService';

/**
 * Tracks questionnaire conversation state
 * Stores where customer is in the questionnaire flow
 */
interface QuestionnaireContext {
  questionnaireId: string;
  questionnaire: Questionnaire;
  currentQuestionIndex: number;
  responses: Record<string, any>; // questionId -> answer
  startedAt: Date;
  conversationId: string;
  contactId: string;
}

/**
 * QuestionnaireRuntimeService
 * Manages questionnaire conversation flow, question delivery, and response collection
 */
export class QuestionnaireRuntimeService {
  // In-memory context storage (per conversation)
  // In production, this could be moved to Redis or database for persistence
  private activeContexts: Map<string, QuestionnaireContext> = new Map();

  /**
   * Start a new questionnaire conversation
   */
  startQuestionnaire(
    conversationId: string,
    contactId: string,
    questionnaire: Questionnaire
  ): void {
    const context: QuestionnaireContext = {
      questionnaireId: questionnaire.id,
      questionnaire,
      currentQuestionIndex: 0,
      responses: {},
      startedAt: new Date(),
      conversationId,
      contactId,
    };

    this.activeContexts.set(conversationId, context);
    console.log(`📋 Started questionnaire "${questionnaire.name}" for conversation ${conversationId}`);
  }

  /**
   * Check if conversation has an active questionnaire
   */
  hasActiveQuestionnaire(conversationId: string): boolean {
    return this.activeContexts.has(conversationId);
  }

  /**
   * Get active questionnaire context
   */
  getContext(conversationId: string): QuestionnaireContext | undefined {
    return this.activeContexts.get(conversationId);
  }

  /**
   * Get the current question for a conversation
   */
  getCurrentQuestion(conversationId: string): Question | null {
    const context = this.activeContexts.get(conversationId);
    if (!context) return null;

    const question = context.questionnaire.questions[context.currentQuestionIndex];
    return question || null;
  }

  /**
   * Format current question as a WhatsApp message
   */
  formatCurrentQuestion(conversationId: string): string | null {
    const context = this.activeContexts.get(conversationId);
    if (!context) return null;

    const question = context.questionnaire.questions[context.currentQuestionIndex];
    if (!question) return null;

    const totalQuestions = context.questionnaire.questions.length;
    const questionNumber = context.currentQuestionIndex + 1;

    let message = `📋 *${context.questionnaire.name}*\n`;
    message += `Question ${questionNumber}/${totalQuestions}\n\n`;
    message += `${question.text}`;

    if (question.required) {
      message += ` *`;
    }

    // Add options for multiple choice questions
    if (question.type === 'multiple_choice' && question.options) {
      message += '\n\nPlease choose one or more (comma-separated):\n';
      question.options.forEach((opt, i) => {
        message += `${i + 1}. ${opt}\n`;
      });
    } else if (question.type === 'yes_no') {
      message += '\n\nPlease answer: *Yes* or *No*';
    } else if (question.type === 'text') {
      message += '\n\nPlease type your answer below.';
    }

    if (question.required) {
      message += '\n\n_* Required question_';
    }

    return message;
  }

  /**
   * Validate and save a response to the current question
   */
  saveResponse(conversationId: string, response: string): {
    valid: boolean;
    error?: string;
    completed?: boolean;
  } {
    const context = this.activeContexts.get(conversationId);
    if (!context) {
      return { valid: false, error: 'No active questionnaire found' };
    }

    const question = context.questionnaire.questions[context.currentQuestionIndex];
    if (!question) {
      return { valid: false, error: 'Invalid question index' };
    }

    // Validate response
    const validation = this.validateResponse(question, response);
    if (!validation.valid) {
      return validation;
    }

    // Save the response
    context.responses[question.id] = validation.parsedValue || response;
    
    console.log(`✅ Saved response for question ${context.currentQuestionIndex + 1}: ${response}`);

    // Move to next question
    context.currentQuestionIndex++;

    // Check if questionnaire is complete
    const completed = context.currentQuestionIndex >= context.questionnaire.questions.length;

    if (completed) {
      console.log(`🎉 Questionnaire "${context.questionnaire.name}" completed!`);
    }

    return { valid: true, completed };
  }

  /**
   * Validate a response based on question type
   */
  private validateResponse(question: Question, response: string): {
    valid: boolean;
    error?: string;
    parsedValue?: any;
  } {
    const trimmedResponse = response.trim();

    // Check required fields
    if (question.required && !trimmedResponse) {
      return {
        valid: false,
        error: 'This question is required. Please provide an answer.',
      };
    }

    // If not required and empty, allow it
    if (!trimmedResponse) {
      return { valid: true, parsedValue: null };
    }

    // Validate based on question type
    switch (question.type) {
      case 'yes_no':
        const yesPatterns = /^(yes|y|yeah|yep|yup|si|ja|oui)$/i;
        const noPatterns = /^(no|n|nope|nah|nein|non)$/i;
        
        if (yesPatterns.test(trimmedResponse)) {
          return { valid: true, parsedValue: 'yes' };
        } else if (noPatterns.test(trimmedResponse)) {
          return { valid: true, parsedValue: 'no' };
        } else {
          return {
            valid: false,
            error: 'Please answer with "Yes" or "No".',
          };
        }

      case 'multiple_choice':
        if (!question.options) {
          return { valid: true, parsedValue: trimmedResponse };
        }

        // Parse comma-separated selections
        const selections = trimmedResponse.split(',').map(s => s.trim());
        const validSelections: string[] = [];

        for (const selection of selections) {
          // Check if it's a number (option index)
          const optionIndex = parseInt(selection) - 1;
          if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < question.options.length) {
            validSelections.push(question.options[optionIndex]);
          } 
          // Check if it matches an option text
          else {
            const matchedOption = question.options.find(
              opt => opt.toLowerCase() === selection.toLowerCase()
            );
            if (matchedOption) {
              validSelections.push(matchedOption);
            } else {
              return {
                valid: false,
                error: `"${selection}" is not a valid option. Please choose from the listed options or use numbers.`,
              };
            }
          }
        }

        return { valid: true, parsedValue: validSelections };

      case 'text':
      default:
        return { valid: true, parsedValue: trimmedResponse };
    }
  }

  /**
   * Get collected responses for saving to database
   */
  getResponses(conversationId: string): Record<string, any> | null {
    const context = this.activeContexts.get(conversationId);
    return context ? context.responses : null;
  }

  /**
   * Get questionnaire ID for a conversation
   */
  getQuestionnaireId(conversationId: string): string | null {
    const context = this.activeContexts.get(conversationId);
    return context ? context.questionnaireId : null;
  }

  /**
   * Get contact ID for a conversation
   */
  getContactId(conversationId: string): string | null {
    const context = this.activeContexts.get(conversationId);
    return context ? context.contactId : null;
  }

  /**
   * Clear questionnaire context after completion or cancellation
   */
  clearContext(conversationId: string): void {
    const context = this.activeContexts.get(conversationId);
    if (context) {
      console.log(`🗑️  Cleared questionnaire context for conversation ${conversationId}`);
    }
    this.activeContexts.delete(conversationId);
  }

  /**
   * Cancel active questionnaire (if customer wants to skip)
   */
  cancelQuestionnaire(conversationId: string): void {
    const context = this.activeContexts.get(conversationId);
    if (context) {
      console.log(`❌ Cancelled questionnaire "${context.questionnaire.name}" for conversation ${conversationId}`);
      this.clearContext(conversationId);
    }
  }

  /**
   * Get progress summary
   */
  getProgress(conversationId: string): string | null {
    const context = this.activeContexts.get(conversationId);
    if (!context) return null;

    const answered = context.currentQuestionIndex;
    const total = context.questionnaire.questions.length;
    const percentage = Math.round((answered / total) * 100);

    return `Progress: ${answered}/${total} questions (${percentage}%)`;
  }
}

export default new QuestionnaireRuntimeService();
