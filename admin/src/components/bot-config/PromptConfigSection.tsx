import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../lib/api';
import { Save, Eye, EyeOff, Brain, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const PromptConfigSection = () => {
  const queryClient = useQueryClient();
  const [showMasterPrompt, setShowMasterPrompt] = useState(false);
  const [formData, setFormData] = useState({
    business_fine_tuning_prompt: '',
    tone_of_voice: 'professional',
    response_style: 'concise',
  });

  const { data: settings } = useQuery({
    queryKey: ['settings', 'bot_config'],
    queryFn: async () => {
      const res = await settingsApi.getAll('bot_config');
      return res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      const getSetting = (key: string) => {
        const setting = settings.find((s: any) => s.key === key);
        return setting?.value || '';
      };

      setFormData({
        business_fine_tuning_prompt: getSetting('business_fine_tuning_prompt'),
        tone_of_voice: getSetting('tone_of_voice') || 'professional',
        response_style: getSetting('response_style') || 'concise',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const promises = Object.entries(data).map(([key, value]) =>
        settingsApi.update(key, value)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Prompt configuration saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save prompt configuration');
    },
  });

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Two-Tier Prompt Architecture:</strong> The Master System Prompt contains core AI logic (read-only). 
          You can customize the personality and tone using the Business Fine-Tuning Prompt below.
        </p>
      </div>

      {/* Master System Prompt (Read-Only) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Master System Prompt (Core AI Logic)
          </h3>
          <button
            onClick={() => setShowMasterPrompt(!showMasterPrompt)}
            className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            {showMasterPrompt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showMasterPrompt ? 'Hide' : 'Show'} Master Prompt
          </button>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-700 mb-2">
            🔒 <strong>Read-Only:</strong> This prompt contains core booking logic, escalation rules, 
            CRM data extraction, and professional customer service behavior. It cannot be edited to ensure 
            consistent, reliable bot operation.
          </p>
          
          {showMasterPrompt && (
            <div className="mt-4 p-4 bg-white rounded border border-gray-300 max-h-96 overflow-y-auto">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
{`# Master System Prompt (Core Instructions)

## Your Role
You are an intelligent customer service assistant for {BUSINESS_NAME}, handling customer inquiries via WhatsApp with empathy, efficiency, and intelligence.

## Core Capabilities
1. Appointment Booking - Facilitate bookings with team member selection, availability checking
2. Questionnaire Administration - Gather customer data through structured questions
3. Promotion Management - Offer discounts and promotions intelligently
4. CRM Data Extraction - Build comprehensive customer profiles
5. Multi-Session Booking - Handle services requiring multiple appointments
6. Smart Escalation - Know when to involve human agents

For full details, see: MASTER_SYSTEM_PROMPT.md (494 lines)
              `}</pre>
              <a
                href="/MASTER_SYSTEM_PROMPT.md"
                target="_blank"
                className="text-blue-600 hover:underline text-sm mt-2 inline-block"
              >
                View Full Master Prompt →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Business Fine-Tuning Prompt (Editable) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Business Fine-Tuning Prompt (Customize Personality)
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Add business-specific personality, cultural nuances, and communication style. 
          This layers on top of the Master Prompt to personalize the bot for your business.
        </p>

        <textarea
          value={formData.business_fine_tuning_prompt}
          onChange={(e) => setFormData({ ...formData, business_fine_tuning_prompt: e.target.value })}
          placeholder={`Example:

Du bist ein digitaler Assistent einer Schweizer Zahnarztpraxis (Praxis Dr. Meier, Zürich). 

Rolle & Identität:
🦷 Rolle: Freundlicher Empfangsmitarbeiter einer modernen Zahnarztpraxis
🇨🇭 Sprache: Nutze formelles Sie (nicht du) in Deutsch, außer der Kunde wünscht es anders
😊 Ton: Empathisch und beruhigend, besonders bei nervösen Patienten

Kommunikationsstil:
- Sei professionell aber warmherzig
- Zeige Verständnis für Zahnarztangst
- Erkläre Behandlungen klar und beruhigend
- Verwende Schweizer Rechtschreibung (z.B. "Termin" statt "Date")

Spezielle Hinweise:
- Viele Patienten haben Angst - sei besonders einfühlsam
- Wir sind spezialisiert auf schmerzfreie Behandlungen
- Bei Notfällen: Immer sofortige Termine anbieten`}
          rows={12}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />

        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>💡 Tip:</strong> Define your brand voice, cultural nuances, typical customer concerns, 
            and any business-specific instructions here. This makes the bot feel like it truly represents your business.
          </p>
        </div>
      </div>

      {/* Quick Tone Settings */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tone of Voice</h3>
          <select
            value={formData.tone_of_voice}
            onChange={(e) => setFormData({ ...formData, tone_of_voice: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="professional">Professional & Formal</option>
            <option value="friendly">Friendly & Casual</option>
            <option value="empathetic">Empathetic & Caring</option>
            <option value="concise">Direct & Concise</option>
            <option value="enthusiastic">Enthusiastic & Energetic</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">
            General communication style for the bot
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Style</h3>
          <select
            value={formData.response_style}
            onChange={(e) => setFormData({ ...formData, response_style: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="concise">Concise (1-2 sentences)</option>
            <option value="balanced">Balanced (2-4 sentences)</option>
            <option value="detailed">Detailed (full explanations)</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">
            How verbose the bot's responses should be
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate(formData)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saveMutation.isPending ? 'Saving...' : 'Save Prompt Configuration'}
        </button>
      </div>
    </div>
  );
};

export default PromptConfigSection;
