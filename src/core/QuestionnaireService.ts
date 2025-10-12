import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';

interface Question {
  id: string;
  text: string;
  type: 'text' | 'single_choice' | 'multiple_choice' | 'yes_no' | 'number';
  options?: string[];
  required: boolean;
}

interface Questionnaire {
  id: string;
  name: string;
  description?: string;
  questions: Question[];
  isActive: boolean;
  triggerType?: 'new_contact' | 'first_booking' | 'manual';
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  contactId: string;
  conversationId?: string;
  responses: Record<string, any>;
  completedAt?: Date;
  createdAt: Date;
}

export class QuestionnaireService {
  async createQuestionnaire(data: {
    name: string;
    description?: string;
    questions: Question[];
    triggerType?: 'new_contact' | 'first_booking' | 'manual';
    createdBy?: string;
  }): Promise<Questionnaire> {
    const { data: questionnaire, error } = await supabase
      .from('questionnaires')
      .insert(toSnakeCase({
        name: data.name,
        description: data.description,
        questions: data.questions,
        triggerType: data.triggerType,
        isActive: true,
        createdBy: data.createdBy,
      }))
      .select()
      .single();

    if (error) throw new Error(`Failed to create questionnaire: ${error.message}`);
    return toCamelCase(questionnaire) as Questionnaire;
  }

  async getActiveQuestionnaires(triggerType?: string): Promise<Questionnaire[]> {
    let query = supabase
      .from('questionnaires')
      .select('*')
      .eq('is_active', true);

    if (triggerType) {
      query = query.eq('trigger_type', triggerType);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get questionnaires: ${error.message}`);
    return (data || []).map(toCamelCase) as Questionnaire[];
  }

  async getQuestionnaireById(id: string): Promise<Questionnaire | null> {
    const { data, error } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return toCamelCase(data) as Questionnaire;
  }

  async saveResponse(data: {
    questionnaireId: string;
    contactId: string;
    conversationId?: string;
    responses: Record<string, any>;
  }): Promise<QuestionnaireResponse> {
    const { data: response, error } = await supabase
      .from('questionnaire_responses')
      .insert(toSnakeCase({
        questionnaireId: data.questionnaireId,
        contactId: data.contactId,
        conversationId: data.conversationId,
        responses: data.responses,
        completedAt: new Date(),
      }))
      .select()
      .single();

    if (error) throw new Error(`Failed to save questionnaire response: ${error.message}`);
    return toCamelCase(response) as QuestionnaireResponse;
  }

  async getContactResponses(contactId: string): Promise<QuestionnaireResponse[]> {
    const { data, error } = await supabase
      .from('questionnaire_responses')
      .select('*, questionnaires(name)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get contact responses: ${error.message}`);
    return (data || []).map(toCamelCase) as QuestionnaireResponse[];
  }

  async generateConversationalQuestion(
    questionnaire: Questionnaire, 
    currentQuestionIndex: number
  ): string {
    const question = questionnaire.questions[currentQuestionIndex];
    
    let message = `📋 ${question.text}`;
    
    if (question.type === 'single_choice' && question.options) {
      message += '\n\nPlease choose one:\n' + 
        question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
    } else if (question.type === 'multiple_choice' && question.options) {
      message += '\n\nYou can select multiple (separated by commas):\n' + 
        question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
    } else if (question.type === 'yes_no') {
      message += '\n\nPlease answer: Yes or No';
    }

    return message;
  }

  async updateQuestionnaire(id: string, updates: Partial<Questionnaire>): Promise<void> {
    await supabase
      .from('questionnaires')
      .update(toSnakeCase(updates))
      .eq('id', id);
  }

  async deactivateQuestionnaire(id: string): Promise<void> {
    await supabase
      .from('questionnaires')
      .update({ is_active: false })
      .eq('id', id);
  }
}
