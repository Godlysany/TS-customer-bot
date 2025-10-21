import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botConfigApi } from '../lib/api';
import { Bot, Brain, MessageSquare, Shield, Plus, Trash2, Save } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const BotConfiguration = () => {
  const [activeTab, setActiveTab] = useState('context');

  const tabs = [
    { id: 'context', label: 'Business Context & FAQ', icon: MessageSquare },
    { id: 'prompts', label: 'GPT Prompts & Tone', icon: Brain },
    { id: 'questionnaires', label: 'Questionnaires', icon: Bot },
    { id: 'controls', label: 'Advanced Controls', icon: Shield },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bot Configuration</h1>
        <p className="text-gray-600 mt-2">
          Configure your AI assistant's behavior, knowledge, tone, and safeguards to match your business needs
        </p>
      </div>

      <div className="border-b border-gray-200 mb-8">
        <nav className="flex gap-8">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'context' && <BusinessContextSection />}
      {activeTab === 'prompts' && <PromptConfigSection />}
      {activeTab === 'questionnaires' && <QuestionnaireSection />}
      {activeTab === 'controls' && <AdvancedControlsSection />}

      <Toaster position="top-right" />
    </div>
  );
};

const BusinessContextSection = () => {
  const [businessInfo, setBusinessInfo] = useState('');
  const [faqItems, setFaqItems] = useState<{ question: string; answer: string }[]>([]);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });

  const { data: context } = useQuery({
    queryKey: ['bot-context'],
    queryFn: async () => {
      const res = await botConfigApi.getContext();
      return res.data;
    },
  });

  useEffect(() => {
    if (context) {
      setBusinessInfo(context.businessInfo || '');
      setFaqItems(context.faqItems || []);
    }
  }, [context]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => botConfigApi.saveContext(data),
    onSuccess: () => {
      toast.success('Business context saved successfully');
    },
    onError: () => {
      toast.error('Failed to save business context');
    },
  });

  const addFaqItem = () => {
    if (newFaq.question && newFaq.answer) {
      setFaqItems([...faqItems, newFaq]);
      setNewFaq({ question: '', answer: '' });
    }
  };

  const removeFaqItem = (index: number) => {
    setFaqItems(faqItems.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    saveMutation.mutate({
      businessInfo,
      faqItems,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h3>
        <p className="text-sm text-gray-600 mb-4">
          Provide context about your business, services, policies, and anything the bot should know
        </p>
        <textarea
          value={businessInfo}
          onChange={(e) => setBusinessInfo(e.target.value)}
          placeholder="Example: We are a dental clinic specializing in cosmetic dentistry. Opening hours: Mon-Fri 9am-6pm. We offer teeth whitening, veneers, implants..."
          className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">FAQ Knowledge Base</h3>
        <p className="text-sm text-gray-600 mb-6">
          Add common questions and answers to help the bot respond accurately
        </p>

        <div className="space-y-4 mb-6">
          {faqItems.map((item, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium text-gray-900">Q: {item.question}</p>
                <button
                  onClick={() => removeFaqItem(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-700">A: {item.answer}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={newFaq.question}
            onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
            placeholder="Question"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={newFaq.answer}
            onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
            placeholder="Answer"
            className="w-full h-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addFaqItem}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add FAQ Item
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        <Save className="w-5 h-5" />
        Save Business Context
      </button>
    </div>
  );
};

const PromptConfigSection = () => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [toneOfVoice, setToneOfVoice] = useState('professional');
  const [escalationTriggers, setEscalationTriggers] = useState<string[]>([]);
  const [newTrigger, setNewTrigger] = useState('');
  const [responseStyle, setResponseStyle] = useState('concise');

  const { data: promptConfig } = useQuery({
    queryKey: ['bot-prompts'],
    queryFn: async () => {
      const res = await botConfigApi.getPrompts();
      return res.data;
    },
  });

  useEffect(() => {
    if (promptConfig) {
      setSystemPrompt(promptConfig.systemPrompt || '');
      setToneOfVoice(promptConfig.toneOfVoice || 'professional');
      setEscalationTriggers(promptConfig.escalationTriggers || []);
      setResponseStyle(promptConfig.responseStyle || 'concise');
    }
  }, [promptConfig]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => botConfigApi.savePrompts(data),
    onSuccess: () => {
      toast.success('GPT configuration saved successfully');
    },
    onError: () => {
      toast.error('Failed to save GPT configuration');
    },
  });

  const addTrigger = () => {
    if (newTrigger && !escalationTriggers.includes(newTrigger)) {
      setEscalationTriggers([...escalationTriggers, newTrigger]);
      setNewTrigger('');
    }
  };

  const removeTrigger = (trigger: string) => {
    setEscalationTriggers(escalationTriggers.filter(t => t !== trigger));
  };

  const handleSave = () => {
    saveMutation.mutate({
      systemPrompt,
      toneOfVoice,
      escalationTriggers,
      responseStyle,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Prompt</h3>
        <p className="text-sm text-gray-600 mb-4">
          Define the core instructions and personality for your AI assistant
        </p>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful assistant for [Business Name]. You should be professional, empathetic, and always prioritize customer satisfaction..."
          className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tone of Voice</h3>
          <select
            value={toneOfVoice}
            onChange={(e) => setToneOfVoice(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="professional">Professional & Formal</option>
            <option value="friendly">Friendly & Casual</option>
            <option value="empathetic">Empathetic & Caring</option>
            <option value="concise">Direct & Concise</option>
            <option value="enthusiastic">Enthusiastic & Energetic</option>
          </select>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Style</h3>
          <select
            value={responseStyle}
            onChange={(e) => setResponseStyle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="concise">Concise (1-2 sentences)</option>
            <option value="balanced">Balanced (2-4 sentences)</option>
            <option value="detailed">Detailed (full explanations)</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Escalation Triggers</h3>
        <p className="text-sm text-gray-600 mb-4">
          Keywords or phrases that should automatically escalate to a human agent
        </p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {escalationTriggers.map((trigger) => (
            <span
              key={trigger}
              className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
            >
              {trigger}
              <button
                onClick={() => removeTrigger(trigger)}
                className="hover:text-red-900"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newTrigger}
            onChange={(e) => setNewTrigger(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTrigger()}
            placeholder="e.g., speak to manager, complaint, refund"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addTrigger}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        <Save className="w-5 h-5" />
        Save GPT Configuration
      </button>
    </div>
  );
};

const QuestionnaireSection = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'anamnesis',
    triggerType: 'before_booking',
    questions: [] as { text: string; type: string }[],
  });

  const { data: questionnaireList } = useQuery({
    queryKey: ['questionnaires'],
    queryFn: async () => {
      const res = await botConfigApi.getQuestionnaires();
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => botConfigApi.saveQuestionnaire(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire saved successfully');
      setEditing(null);
      setFormData({ name: '', type: 'anamnesis', triggerType: 'before_booking', questions: [] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save questionnaire');
    },
  });

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [...formData.questions, { text: '', type: 'text' }],
    });
  };

  const updateQuestion = (index: number, field: string, value: string) => {
    const updated = [...formData.questions];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, questions: updated });
  };

  const removeQuestion = (index: number) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter((_, i) => i !== index),
    });
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Questionnaires</strong> allow the bot to collect information from customers at specific points in the conversation.
          Configure when and how to run anamnesis forms, feedback surveys, and custom questionnaires.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {editing ? 'Edit Questionnaire' : 'Create New Questionnaire'}
          </h3>
          {editing && (
            <button
              onClick={() => {
                setEditing(null);
                setFormData({ name: '', type: 'anamnesis', triggerType: 'before_booking', questions: [] });
              }}
              className="text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Questionnaire Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Pre-Appointment Anamnesis"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="anamnesis">Anamnesis (Medical History)</option>
                <option value="feedback">Feedback/Review</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trigger</label>
              <select
                value={formData.triggerType}
                onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="before_booking">Before Booking</option>
                <option value="after_booking">After Booking Confirmed</option>
                <option value="after_appointment">After Appointment</option>
                <option value="manual">Manual Trigger</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Questions</label>
            <div className="space-y-3">
              {formData.questions.map((q, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                    placeholder="Question text"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                    className="w-32 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="text">Text</option>
                    <option value="yes_no">Yes/No</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                  </select>
                  <button
                    onClick={() => removeQuestion(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addQuestion}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !formData.name || formData.questions.length === 0}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Questionnaire
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Existing Questionnaires</h3>
        <div className="space-y-3">
          {questionnaireList?.map((q: any) => (
            <div key={q.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900">{q.name}</p>
                <p className="text-sm text-gray-600">
                  {q.type} • Trigger: {q.trigger_type} • {q.questions?.length || 0} questions
                </p>
              </div>
              <button
                onClick={() => setEditing(q.id)}
                className="px-3 py-1 text-blue-600 hover:text-blue-700"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AdvancedControlsSection = () => {
  const [controls, setControls] = useState({
    enableAutoResponse: true,
    enableQuestionnaires: true,
    enableBooking: true,
    requireHumanApproval: false,
    maxResponseLength: 300,
    confidenceThreshold: 0.7,
    enableSentimentAnalysis: true,
    enableFallback: true,
    fallbackMessage: "I'm not sure about that. Let me connect you with a team member who can help.",
  });

  const { data: controlsData } = useQuery({
    queryKey: ['bot-controls'],
    queryFn: async () => {
      const res = await botConfigApi.getControls();
      return res.data;
    },
  });

  useEffect(() => {
    if (controlsData) {
      setControls(controlsData);
    }
  }, [controlsData]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => botConfigApi.saveControls(data),
    onSuccess: () => {
      toast.success('Advanced controls saved successfully');
    },
    onError: () => {
      toast.error('Failed to save advanced controls');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(controls);
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>⚠️ Brand Protection:</strong> These controls help prevent AI from damaging your customer experience.
          Configure safeguards, approval workflows, and fallback behaviors.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Feature Toggles</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-gray-700">Auto-Response (Bot replies automatically)</span>
            <input
              type="checkbox"
              checked={controls.enableAutoResponse}
              onChange={(e) => setControls({ ...controls, enableAutoResponse: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-700">Questionnaires (Run anamnesis/feedback)</span>
            <input
              type="checkbox"
              checked={controls.enableQuestionnaires}
              onChange={(e) => setControls({ ...controls, enableQuestionnaires: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-700">Booking System (Allow appointment booking)</span>
            <input
              type="checkbox"
              checked={controls.enableBooking}
              onChange={(e) => setControls({ ...controls, enableBooking: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-700">Sentiment Analysis (Track customer emotions)</span>
            <input
              type="checkbox"
              checked={controls.enableSentimentAnalysis}
              onChange={(e) => setControls({ ...controls, enableSentimentAnalysis: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Safety Controls</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-gray-700">Require Human Approval (Review before sending)</span>
            <input
              type="checkbox"
              checked={controls.requireHumanApproval}
              onChange={(e) => setControls({ ...controls, requireHumanApproval: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Response Length (characters)
            </label>
            <input
              type="number"
              value={controls.maxResponseLength}
              onChange={(e) => setControls({ ...controls, maxResponseLength: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Threshold (0-1, escalate if below)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={controls.confidenceThreshold}
              onChange={(e) => setControls({ ...controls, confidenceThreshold: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fallback Behavior</h3>
        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={controls.enableFallback}
            onChange={(e) => setControls({ ...controls, enableFallback: e.target.checked })}
            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-700">Enable Fallback Message</span>
        </label>
        <textarea
          value={controls.fallbackMessage}
          onChange={(e) => setControls({ ...controls, fallbackMessage: e.target.value })}
          disabled={!controls.enableFallback}
          placeholder="Message to send when bot is uncertain"
          className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        <Save className="w-5 h-5" />
        Save Advanced Controls
      </button>
    </div>
  );
};

export default BotConfiguration;
