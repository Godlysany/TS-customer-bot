import { useState } from 'react';
import { Bot, Brain, Shield, Mail, AlertTriangle, Volume2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

// Import all configuration sections
import PromptConfigSection from '../components/bot-config/PromptConfigSection';
import EscalationConfigSection from '../components/bot-config/EscalationConfigSection';
import EmailCollectionSection from '../components/bot-config/EmailCollectionSection';
import TTSConfigSection from '../components/bot-config/TTSConfigSection';
import AdvancedControlsSection from '../components/bot-config/AdvancedControlsSection';

const BotConfiguration = () => {
  const [activeTab, setActiveTab] = useState('prompts');

  const tabs = [
    { id: 'prompts', label: 'GPT Prompts & Tone', icon: Brain, description: 'AI personality & behavior' },
    { id: 'escalation', label: 'Escalation Rules', icon: AlertTriangle, description: 'When to involve humans' },
    { id: 'email', label: 'Email Collection', icon: Mail, description: 'How to gather emails' },
    { id: 'tts', label: 'Voice & TTS', icon: Volume2, description: 'Voice message handling' },
    { id: 'controls', label: 'Advanced Controls', icon: Shield, description: 'Feature toggles & safeguards' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Bot className="w-8 h-8 text-blue-600" />
          Bot Configuration
        </h1>
        <p className="text-gray-600 mt-2">
          Configure your AI assistant's behavior, knowledge, tone, and safeguards to match your business needs.
          Changes are automatically used by the bot after saving.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, description }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-start px-4 py-3 border-b-2 font-medium text-sm transition-colors min-w-[160px] ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                {label}
              </div>
              <span className="text-xs text-gray-500 mt-1">{description}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'prompts' && <PromptConfigSection />}
        {activeTab === 'escalation' && <EscalationConfigSection />}
        {activeTab === 'email' && <EmailCollectionSection />}
        {activeTab === 'tts' && <TTSConfigSection />}
        {activeTab === 'controls' && <AdvancedControlsSection />}
      </div>

      <Toaster position="top-right" />
    </div>
  );
};

export default BotConfiguration;
