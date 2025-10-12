"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAIClient = getOpenAIClient;
const openai_1 = __importDefault(require("openai"));
const SettingsService_1 = __importDefault(require("../core/SettingsService"));
let openaiClient = null;
async function getOpenAIClient() {
    const apiKey = await SettingsService_1.default.getOpenAIKey();
    if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please set it in CRM settings.');
    }
    if (!openaiClient || openaiClient.apiKey !== apiKey) {
        openaiClient = new openai_1.default({ apiKey });
    }
    return openaiClient;
}
exports.default = getOpenAIClient;
