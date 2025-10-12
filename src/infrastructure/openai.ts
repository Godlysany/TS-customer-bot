import OpenAI from 'openai';
import settingsService from '../core/SettingsService';

let openaiClient: OpenAI | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  const apiKey = await settingsService.getOpenAIKey();
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please set it in CRM settings.');
  }

  if (!openaiClient || openaiClient.apiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export default getOpenAIClient;
