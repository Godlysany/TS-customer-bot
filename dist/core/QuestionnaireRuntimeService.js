"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionnaireRuntimeService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const logger_1 = require("../infrastructure/logger");
/**
 * QuestionnaireRuntimeService
 * Manages questionnaire conversation flow, question delivery, and response collection
 * H1: Database-backed session persistence to prevent loss on server restart
 */
class QuestionnaireRuntimeService {
    // H1: Database-backed with in-memory cache for performance
    activeContexts = new Map();
    isRehydrated = false;
    /**
     * H1: Rehydrate sessions from database on startup
     */
    async rehydrateSessions() {
        if (this.isRehydrated)
            return;
        try {
            const { data: sessions, error } = await supabase_1.supabase
                .from('questionnaire_sessions')
                .select('*')
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString());
            if (error)
                throw error;
            for (const session of sessions || []) {
                // Fetch questionnaire data
                const { data: questionnaire } = await supabase_1.supabase
                    .from('questionnaires')
                    .select('*')
                    .eq('id', session.questionnaire_id)
                    .single();
                if (questionnaire) {
                    this.activeContexts.set(session.conversation_id, {
                        questionnaireId: session.questionnaire_id,
                        questionnaire: questionnaire,
                        currentQuestionIndex: session.current_question_index,
                        responses: session.answers || {},
                        startedAt: new Date(session.started_at),
                        conversationId: session.conversation_id,
                        contactId: session.contact_id,
                        sessionId: session.id,
                    });
                }
            }
            this.isRehydrated = true;
            (0, logger_1.logInfo)(`H1: Rehydrated ${sessions?.length || 0} active questionnaire sessions`);
        }
        catch (error) {
            (0, logger_1.logError)('Failed to rehydrate questionnaire sessions', error);
        }
    }
    /**
     * Start a new questionnaire conversation (H1: with database persistence)
     */
    async startQuestionnaire(conversationId, contactId, questionnaire) {
        const context = {
            questionnaireId: questionnaire.id,
            questionnaire,
            currentQuestionIndex: 0,
            responses: {},
            startedAt: new Date(),
            conversationId,
            contactId,
        };
        // H1: Persist to database
        try {
            const { data: session, error } = await supabase_1.supabase
                .from('questionnaire_sessions')
                .insert({
                conversation_id: conversationId,
                contact_id: contactId,
                questionnaire_id: questionnaire.id,
                current_question_index: 0,
                answers: {},
                is_active: true,
            })
                .select('id')
                .single();
            if (!error && session) {
                context.sessionId = session.id;
            }
        }
        catch (error) {
            (0, logger_1.logWarn)('Failed to persist questionnaire session to database', error);
        }
        this.activeContexts.set(conversationId, context);
        (0, logger_1.logInfo)(`📋 Started questionnaire "${questionnaire.name}" for conversation ${conversationId}`);
    }
    /**
     * Check if conversation has an active questionnaire
     */
    hasActiveQuestionnaire(conversationId) {
        return this.activeContexts.has(conversationId);
    }
    /**
     * Get active questionnaire context
     */
    getContext(conversationId) {
        return this.activeContexts.get(conversationId);
    }
    /**
     * Get the current question for a conversation
     */
    getCurrentQuestion(conversationId) {
        const context = this.activeContexts.get(conversationId);
        if (!context)
            return null;
        const question = context.questionnaire.questions[context.currentQuestionIndex];
        return question || null;
    }
    /**
     * Format current question as a WhatsApp message
     */
    formatCurrentQuestion(conversationId) {
        const context = this.activeContexts.get(conversationId);
        if (!context)
            return null;
        const question = context.questionnaire.questions[context.currentQuestionIndex];
        if (!question)
            return null;
        const totalQuestions = context.questionnaire.questions.length;
        const questionNumber = context.currentQuestionIndex + 1;
        let message = `📋 *${context.questionnaire.name}*\n`;
        message += `Question ${questionNumber}/${totalQuestions}\n\n`;
        message += `${question.text}`;
        if (question.required) {
            message += ` *`;
        }
        // Add options for choice questions
        if (question.type === 'single_choice' && question.options) {
            message += '\n\nPlease choose one:\n';
            question.options.forEach((opt, i) => {
                message += `${i + 1}. ${opt}\n`;
            });
        }
        else if (question.type === 'multiple_choice' && question.options) {
            message += '\n\nPlease choose one or more (comma-separated):\n';
            question.options.forEach((opt, i) => {
                message += `${i + 1}. ${opt}\n`;
            });
        }
        else if (question.type === 'yes_no') {
            message += '\n\nPlease answer: *Yes* or *No*';
        }
        else if (question.type === 'text') {
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
    saveResponse(conversationId, response) {
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
        (0, logger_1.logInfo)(`✅ Saved response for question ${context.currentQuestionIndex + 1}: ${response}`);
        // Move to next question
        context.currentQuestionIndex++;
        // H1: Persist progress to database
        this.persistSessionProgress(context).catch(err => (0, logger_1.logWarn)('Failed to persist questionnaire progress', err));
        // Check if questionnaire is complete
        const completed = context.currentQuestionIndex >= context.questionnaire.questions.length;
        if (completed) {
            (0, logger_1.logInfo)(`🎉 Questionnaire "${context.questionnaire.name}" completed!`);
        }
        return { valid: true, completed };
    }
    /**
     * Validate a response based on question type
     */
    validateResponse(question, response) {
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
                }
                else if (noPatterns.test(trimmedResponse)) {
                    return { valid: true, parsedValue: 'no' };
                }
                else {
                    return {
                        valid: false,
                        error: 'Please answer with "Yes" or "No".',
                    };
                }
            case 'single_choice':
                if (!question.options) {
                    return { valid: true, parsedValue: trimmedResponse };
                }
                // Check if it's a number (option index)
                const optionIndex = parseInt(trimmedResponse) - 1;
                if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < question.options.length) {
                    return { valid: true, parsedValue: question.options[optionIndex] };
                }
                // Check if it matches an option text
                const matchedOption = question.options.find(opt => opt.toLowerCase() === trimmedResponse.toLowerCase());
                if (matchedOption) {
                    return { valid: true, parsedValue: matchedOption };
                }
                return {
                    valid: false,
                    error: `"${trimmedResponse}" is not a valid option. Please choose from the listed options or use a number (1-${question.options.length}).`,
                };
            case 'multiple_choice':
                if (!question.options) {
                    return { valid: true, parsedValue: trimmedResponse };
                }
                // Parse comma-separated selections
                const selections = trimmedResponse.split(',').map(s => s.trim());
                const validSelections = [];
                for (const selection of selections) {
                    // Check if it's a number (option index)
                    const optionIndex = parseInt(selection) - 1;
                    if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < question.options.length) {
                        validSelections.push(question.options[optionIndex]);
                    }
                    // Check if it matches an option text
                    else {
                        const matchedOption = question.options.find(opt => opt.toLowerCase() === selection.toLowerCase());
                        if (matchedOption) {
                            validSelections.push(matchedOption);
                        }
                        else {
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
    getResponses(conversationId) {
        const context = this.activeContexts.get(conversationId);
        return context ? context.responses : null;
    }
    /**
     * Get questionnaire ID for a conversation
     */
    getQuestionnaireId(conversationId) {
        const context = this.activeContexts.get(conversationId);
        return context ? context.questionnaireId : null;
    }
    /**
     * Get contact ID for a conversation
     */
    getContactId(conversationId) {
        const context = this.activeContexts.get(conversationId);
        return context ? context.contactId : null;
    }
    /**
     * Clear questionnaire context after completion or cancellation
     */
    clearContext(conversationId) {
        const context = this.activeContexts.get(conversationId);
        if (context) {
            console.log(`🗑️  Cleared questionnaire context for conversation ${conversationId}`);
        }
        this.activeContexts.delete(conversationId);
    }
    /**
     * Cancel active questionnaire (if customer wants to skip)
     */
    cancelQuestionnaire(conversationId) {
        const context = this.activeContexts.get(conversationId);
        if (context) {
            console.log(`❌ Cancelled questionnaire "${context.questionnaire.name}" for conversation ${conversationId}`);
            this.clearContext(conversationId);
        }
    }
    /**
     * Get progress summary
     */
    getProgress(conversationId) {
        const context = this.activeContexts.get(conversationId);
        if (!context)
            return null;
        const answered = context.currentQuestionIndex;
        const total = context.questionnaire.questions.length;
        const percentage = Math.round((answered / total) * 100);
        return `Progress: ${answered}/${total} questions (${percentage}%)`;
    }
    /**
     * H1: Persist session progress to database
     */
    async persistSessionProgress(context) {
        if (!context.sessionId)
            return;
        try {
            await supabase_1.supabase
                .from('questionnaire_sessions')
                .update({
                current_question_index: context.currentQuestionIndex,
                answers: context.responses,
                last_activity_at: new Date().toISOString(),
            })
                .eq('id', context.sessionId);
        }
        catch (error) {
            (0, logger_1.logError)('Failed to persist questionnaire session', error);
        }
    }
    /**
     * H1: Mark session as completed in database
     */
    async completeSession(conversationId) {
        const context = this.activeContexts.get(conversationId);
        if (!context?.sessionId)
            return;
        try {
            await supabase_1.supabase
                .from('questionnaire_sessions')
                .update({
                is_active: false,
                completed_at: new Date().toISOString(),
            })
                .eq('id', context.sessionId);
        }
        catch (error) {
            (0, logger_1.logError)('Failed to complete questionnaire session', error);
        }
    }
}
exports.QuestionnaireRuntimeService = QuestionnaireRuntimeService;
exports.default = new QuestionnaireRuntimeService();
