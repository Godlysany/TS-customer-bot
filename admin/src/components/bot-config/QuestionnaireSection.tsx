import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionnaireApi } from '../../lib/api';
import { Save, MessageSquare, Plus, Trash2, Link as LinkIcon, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

interface Question {
  id: string;
  text: string;
  type: 'text' | 'multiple_choice' | 'yes_no';
  options?: string[];
  required: boolean;
}

interface Questionnaire {
  id?: string;
  name: string;
  description: string;
  trigger_type: string;
  questions: Question[];
  linked_services?: string[];
  linked_promotions?: string[];
  active: boolean;
}

const QuestionnaireSection = () => {
  const queryClient = useQueryClient();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuestionnaire, setNewQuestionnaire] = useState<Questionnaire>({
    name: '',
    description: '',
    trigger_type: 'manual',
    questions: [],
    linked_services: [],
    linked_promotions: [],
    active: true,
  });

  const { data: existingQuestionnaires } = useQuery({
    queryKey: ['questionnaires'],
    queryFn: async () => {
      const res = await questionnaireApi.getAll();
      return res.data;
    },
  });

  useEffect(() => {
    if (existingQuestionnaires) {
      setQuestionnaires(existingQuestionnaires);
    }
  }, [existingQuestionnaires]);

  const saveMutation = useMutation({
    mutationFn: async (questionnaire: Questionnaire) => {
      await questionnaireApi.create(questionnaire);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire saved successfully');
      setNewQuestionnaire({
        name: '',
        description: '',
        trigger_type: 'manual',
        questions: [],
        linked_services: [],
        linked_promotions: [],
        active: true,
      });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save questionnaire');
    },
  });

  const addQuestion = () => {
    setNewQuestionnaire({
      ...newQuestionnaire,
      questions: [
        ...newQuestionnaire.questions,
        {
          id: Date.now().toString(),
          text: '',
          type: 'text',
          required: false,
        },
      ],
    });
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setNewQuestionnaire({
      ...newQuestionnaire,
      questions: newQuestionnaire.questions.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    });
  };

  const removeQuestion = (id: string) => {
    setNewQuestionnaire({
      ...newQuestionnaire,
      questions: newQuestionnaire.questions.filter((q) => q.id !== id),
    });
  };

  const addLinkedService = (service: string) => {
    if (service && !newQuestionnaire.linked_services?.includes(service)) {
      setNewQuestionnaire({
        ...newQuestionnaire,
        linked_services: [...(newQuestionnaire.linked_services || []), service],
      });
    }
  };

  const removeLinkedService = (service: string) => {
    setNewQuestionnaire({
      ...newQuestionnaire,
      linked_services: newQuestionnaire.linked_services?.filter((s) => s !== service),
    });
  };

  const triggerTypes = [
    { value: 'manual', label: 'Manual (Agent triggers)' },
    { value: 'before_booking', label: 'Before Booking (Auto-trigger)' },
    { value: 'after_booking', label: 'After Booking Confirmation' },
    { value: 'first_contact', label: 'First Contact (New customer)' },
    { value: 'service_specific', label: 'Service-Specific (Linked services)' },
  ];

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Questionnaires</strong> collect structured information from customers via WhatsApp. 
          Use them for anamnesis forms, preferences, feedback, or qualifying leads. Link to services 
          to auto-trigger before specific bookings.
        </p>
      </div>

      {/* Existing Questionnaires */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Existing Questionnaires
        </h3>

        {questionnaires.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No questionnaires created yet. Create one below.
          </div>
        ) : (
          <div className="space-y-3">
            {questionnaires.map((q) => (
              <div key={q.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{q.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{q.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Trigger: {triggerTypes.find((t) => t.value === q.trigger_type)?.label}</span>
                      <span>{q.questions.length} questions</span>
                      {q.linked_services && q.linked_services.length > 0 && (
                        <span className="text-blue-600">
                          🔗 {q.linked_services.length} service(s)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        q.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {q.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create New Questionnaire */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Questionnaire</h3>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Questionnaire Name *
              </label>
              <input
                type="text"
                value={newQuestionnaire.name}
                onChange={(e) =>
                  setNewQuestionnaire({ ...newQuestionnaire, name: e.target.value })
                }
                placeholder="e.g., Patient Medical History"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trigger Type *
              </label>
              <select
                value={newQuestionnaire.trigger_type}
                onChange={(e) =>
                  setNewQuestionnaire({ ...newQuestionnaire, trigger_type: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {triggerTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={newQuestionnaire.description}
              onChange={(e) =>
                setNewQuestionnaire({ ...newQuestionnaire, description: e.target.value })
              }
              placeholder="Brief description of what this questionnaire collects"
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Linked Services */}
          {newQuestionnaire.trigger_type === 'service_specific' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Linked Services (Auto-trigger before these bookings)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newQuestionnaire.linked_services?.map((service) => (
                  <span
                    key={service}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {service}
                    <button
                      onClick={() => removeLinkedService(service)}
                      className="hover:text-blue-900"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter service name"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addLinkedService((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This questionnaire will automatically trigger before booking these services
              </p>
            </div>
          )}

          {/* Questions */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Questions</h4>
              <button
                onClick={addQuestion}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>

            {newQuestionnaire.questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                No questions added yet. Click "Add Question" to start.
              </div>
            ) : (
              <div className="space-y-3">
                {newQuestionnaire.questions.map((question, index) => (
                  <div key={question.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={question.text}
                            onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                            placeholder="Question text"
                            className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />

                          <select
                            value={question.type}
                            onChange={(e) =>
                              updateQuestion(question.id, { type: e.target.value as any })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="text">Text Answer</option>
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="yes_no">Yes/No</option>
                          </select>

                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={question.required}
                              onChange={(e) =>
                                updateQuestion(question.id, { required: e.target.checked })
                              }
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">Required</span>
                          </label>
                        </div>

                        {question.type === 'multiple_choice' && (
                          <input
                            type="text"
                            placeholder="Options (comma separated): Option 1, Option 2, Option 3"
                            onChange={(e) =>
                              updateQuestion(question.id, { options: e.target.value.split(',').map((o) => o.trim()) })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => removeQuestion(question.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
            <input
              type="checkbox"
              id="active"
              checked={newQuestionnaire.active}
              onChange={(e) =>
                setNewQuestionnaire({ ...newQuestionnaire, active: e.target.checked })
              }
              className="w-4 h-4"
            />
            <label htmlFor="active" className="text-sm text-gray-700">
              Activate immediately after saving
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate(newQuestionnaire)}
          disabled={saveMutation.isPending || !newQuestionnaire.name || newQuestionnaire.questions.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saveMutation.isPending ? 'Saving...' : 'Save Questionnaire'}
        </button>
      </div>
    </div>
  );
};

export default QuestionnaireSection;
