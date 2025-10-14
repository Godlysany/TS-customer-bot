import Stripe from 'stripe';
import { SettingsService } from '../core/SettingsService';

let stripeClient: Stripe | null = null;
const settingsService = new SettingsService();

export async function getStripeClient(): Promise<Stripe | null> {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = await settingsService.getSetting('stripe_api_key');
  
  if (!apiKey || apiKey.trim() === '') {
    console.warn('⚠️  Stripe API key not configured');
    return null;
  }

  stripeClient = new Stripe(apiKey);

  return stripeClient;
}

export async function isStripeEnabled(): Promise<boolean> {
  const enabled = await settingsService.getSetting('payments_enabled');
  const apiKey = await settingsService.getSetting('stripe_api_key');
  
  return enabled === 'true' && !!apiKey && apiKey.trim() !== '';
}
