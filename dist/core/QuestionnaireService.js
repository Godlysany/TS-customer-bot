"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionnaireService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class QuestionnaireService {
    async createQuestionnaire(data) {
        const { data: questionnaire, error } = await supabase_1.supabase
            .from('questionnaires')
            .insert((0, mapper_1.toSnakeCase)({
            name: data.name,
            description: data.description,
            questions: data.questions,
            triggerType: data.triggerType,
            linkedServices: data.linkedServices,
            linkedPromotions: data.linkedPromotions,
            isActive: true,
            createdBy: data.createdBy,
        }))
            .select()
            .single();
        if (error)
            throw new Error(`Failed to create questionnaire: ${error.message}`);
        return (0, mapper_1.toCamelCase)(questionnaire);
    }
    async getActiveQuestionnaires(triggerType) {
        let query = supabase_1.supabase
            .from('questionnaires')
            .select('*')
            .eq('is_active', true);
        if (triggerType) {
            query = query.eq('trigger_type', triggerType);
        }
        const { data, error } = await query;
        if (error)
            throw new Error(`Failed to get questionnaires: ${error.message}`);
        return (data || []).map(mapper_1.toCamelCase);
    }
    async getQuestionnaireById(id) {
        const { data, error } = await supabase_1.supabase
            .from('questionnaires')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            return null;
        return (0, mapper_1.toCamelCase)(data);
    }
    async saveResponse(data) {
        const { data: response, error } = await supabase_1.supabase
            .from('questionnaire_responses')
            .insert((0, mapper_1.toSnakeCase)({
            questionnaireId: data.questionnaireId,
            contactId: data.contactId,
            conversationId: data.conversationId,
            responses: data.responses,
            completedAt: new Date(),
        }))
            .select()
            .single();
        if (error)
            throw new Error(`Failed to save questionnaire response: ${error.message}`);
        return (0, mapper_1.toCamelCase)(response);
    }
    async getContactResponses(contactId) {
        const { data, error } = await supabase_1.supabase
            .from('questionnaire_responses')
            .select('*, questionnaires(name)')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false });
        if (error)
            throw new Error(`Failed to get contact responses: ${error.message}`);
        return (data || []).map(mapper_1.toCamelCase);
    }
    async generateConversationalQuestion(questionnaire, currentQuestionIndex) {
        const question = questionnaire.questions[currentQuestionIndex];
        let message = `📋 ${question.text}`;
        if (question.type === 'single_choice' && question.options) {
            message += '\n\nPlease choose one:\n' +
                question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
        }
        else if (question.type === 'multiple_choice' && question.options) {
            message += '\n\nYou can select multiple (separated by commas):\n' +
                question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
        }
        else if (question.type === 'yes_no') {
            message += '\n\nPlease answer: Yes or No';
        }
        return message;
    }
    async updateQuestionnaire(id, updates) {
        await supabase_1.supabase
            .from('questionnaires')
            .update((0, mapper_1.toSnakeCase)(updates))
            .eq('id', id);
    }
    async deactivateQuestionnaire(id) {
        await supabase_1.supabase
            .from('questionnaires')
            .update({ is_active: false })
            .eq('id', id);
    }
    /**
     * Get questionnaires for a specific service
     * Used for service_specific trigger type
     */
    async getQuestionnairesForService(serviceId) {
        const { data, error } = await supabase_1.supabase
            .from('questionnaires')
            .select('*')
            .eq('is_active', true)
            .eq('trigger_type', 'service_specific')
            .contains('linked_services', [serviceId]);
        if (error) {
            console.error('Failed to get service questionnaires:', error.message);
            return [];
        }
        return (data || []).map(mapper_1.toCamelCase);
    }
    /**
     * Check if contact has already completed a specific questionnaire
     * Prevents duplicate questionnaire completion
     */
    async hasContactCompletedQuestionnaire(contactId, questionnaireId) {
        const { data, error } = await supabase_1.supabase
            .from('questionnaire_responses')
            .select('id')
            .eq('contact_id', contactId)
            .eq('questionnaire_id', questionnaireId)
            .not('completed_at', 'is', null)
            .limit(1);
        if (error) {
            console.error('Failed to check questionnaire completion:', error.message);
            return false;
        }
        return (data?.length || 0) > 0;
    }
    /**
     * Get all questionnaires (including inactive) for admin management
     */
    async getAllQuestionnaires() {
        const { data, error } = await supabase_1.supabase
            .from('questionnaires')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw new Error(`Failed to get all questionnaires: ${error.message}`);
        return (data || []).map(mapper_1.toCamelCase);
    }
}
exports.QuestionnaireService = QuestionnaireService;
