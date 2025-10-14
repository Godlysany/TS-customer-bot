"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStripeClient = getStripeClient;
exports.isStripeEnabled = isStripeEnabled;
const stripe_1 = __importDefault(require("stripe"));
const SettingsService_1 = require("../core/SettingsService");
let stripeClient = null;
const settingsService = new SettingsService_1.SettingsService();
async function getStripeClient() {
    if (stripeClient) {
        return stripeClient;
    }
    const apiKey = await settingsService.getSetting('stripe_api_key');
    if (!apiKey || apiKey.trim() === '') {
        console.warn('⚠️  Stripe API key not configured');
        return null;
    }
    stripeClient = new stripe_1.default(apiKey);
    return stripeClient;
}
async function isStripeEnabled() {
    const enabled = await settingsService.getSetting('payments_enabled');
    const apiKey = await settingsService.getSetting('stripe_api_key');
    return enabled === 'true' && !!apiKey && apiKey.trim() !== '';
}
