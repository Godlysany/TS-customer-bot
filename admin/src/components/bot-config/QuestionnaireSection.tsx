import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionnaireApi, servicesApi } from '../../lib/api';
import { Save, MessageSquare, Power, AlertCircle, Link as LinkIcon, PlayCircle, PauseCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Questionnaire {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  questions: any[];
  linked_services?: string[];
  linked_promotions?: string[];
  active: boolean;
}

const QuestionnaireSectionNew = () => {
  const queryClient = useQueryClient();
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string | null>(null);
  const [config, setConfig] = useState<{
    active: boolean;
    trigger_type: string;
    linked_services: string[];
    linked_promotions: string[];
  }>({
    active: true,
    trigger_type: 'manual',
    linked_services: [],
    linked_promotions: [],
  });

  const { data: questionnaires = [] } = useQuery<Questionnaire[]>({
    queryKey: ['questionnaires'],
    queryFn: async () => {
      const res = await questionnaireApi.getAll();
      return res.data;
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await servicesApi.getAll();
      return res.data;
    },
  });

  const selectedQ = questionnaires.find(q => q.id === selectedQuestionnaire);

  useEffect(() => {
    if (selectedQ) {
      setConfig({
        active: selectedQ.active ?? true,
        trigger_type: selectedQ.trigger_type || 'manual',
        linked_services: selectedQ.linked_services || [],
        linked_promotions: selectedQ.linked_promotions || [],
      });
    }
  }, [selectedQ]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedQuestionnaire) return;
      await questionnaireApi.update(selectedQuestionnaire, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire configuration updated');
    },
    onError: () => toast.error('Failed to update questionnaire'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!selectedQuestionnaire) return;
      await questionnaireApi.update(selectedQuestionnaire, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const toggleService = (serviceId: string) => {
    const linked = config.linked_services || [];
    if (linked.includes(serviceId)) {
      setConfig({ ...config, linked_services: linked.filter(id => id !== serviceId) });
    } else {
      setConfig({ ...config, linked_services: [...linked, serviceId] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Questionnaire Configuration</strong> - Manage when questionnaires are triggered, which services they link to, and activation status.
          To create new questionnaires or edit questions, use the dedicated Questionnaires Builder (coming soon) or API.
        </p>
      </div>

      {/* Questionnaire Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Select Questionnaire
        </h3>

        <div className="space-y-3">
          {questionnaires.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelectedQuestionnaire(q.id)}
              className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                selectedQuestionnaire === q.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{q.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{q.description}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{q.questions?.length || 0} questions</span>
                    <span>Trigger: {q.trigger_type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {q.active ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Inactive</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {questionnaires.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No questionnaires found. Create one using the Questionnaires API or Builder.</p>
          </div>
        )}
      </div>

      {selectedQ && (
        <>
          {/* Activation Control */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Power className="w-5 h-5 text-blue-600" />
              Activation Status
            </h3>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-semibold text-gray-900">Questionnaire Active</div>
                <div className="text-sm text-gray-600 mt-1">
                  {selectedQ.active ? 'This questionnaire will be triggered according to its configuration' : 'This questionnaire is paused and will not be sent'}
                </div>
              </div>
              <button
                onClick={() => toggleActiveMutation.mutate(!selectedQ.active)}
                disabled={toggleActiveMutation.isPending}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedQ.active
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {selectedQ.active ? (
                  <>
                    <PauseCircle className="w-4 h-4 inline mr-2" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 inline mr-2" />
                    Activate
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trigger Configuration</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Type
                </label>
                <select
                  value={config.trigger_type}
                  onChange={(e) => setConfig({ ...config, trigger_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="manual">Manual (Admin sends)</option>
                  <option value="first_booking">First Booking (Before appointment)</option>
                  <option value="post_booking">Post Booking (After appointment)</option>
                  <option value="post_service">Post Service (After specific service)</option>
                  <option value="new_customer">New Customer (First conversation)</option>
                  <option value="no_show">No-Show (After missed appointment)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  When should this questionnaire be automatically sent to customers?
                </p>
              </div>

              {(config.trigger_type === 'post_service' || config.trigger_type === 'first_booking') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <LinkIcon className="w-4 h-4 inline mr-1" />
                    Linked Services
                  </label>
                  <div className="space-y-2">
                    {services.map((service: any) => (
                      <label key={service.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.linked_services.includes(service.id)}
                          onChange={() => toggleService(service.id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{service.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Questionnaire will only trigger for these specific services
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="mt-6 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>

          {/* Questionnaire Preview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Questionnaire Preview</h3>
            
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <strong>Name:</strong> {selectedQ.name}
              </div>
              <div className="text-sm text-gray-600">
                <strong>Description:</strong> {selectedQ.description}
              </div>
              <div className="text-sm text-gray-600">
                <strong>Total Questions:</strong> {selectedQ.questions?.length || 0}
              </div>
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Questions:</div>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  {selectedQ.questions?.map((q: any, i: number) => (
                    <li key={i}>{q.text} <span className="text-xs text-gray-400">({q.type})</span></li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                To edit questions or create new questionnaires, use the Questionnaires Builder API or dedicated page (coming soon).
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default QuestionnaireSectionNew;
