import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionnaireApi, questionnaireResponsesApi, servicesApi } from '../lib/api';
import { FileText, Search, Plus, Trash2, Edit, X, Save, Calendar, User, Eye, MessageSquare } from 'lucide-react';
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

const Questionnaires = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'questionnaires' | 'responses'>('questionnaires');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState<Questionnaire | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedResponse, setSelectedResponse] = useState<any>(null);

  // Questionnaire form state
  const [formData, setFormData] = useState<Questionnaire>({
    name: '',
    description: '',
    trigger_type: 'manual',
    questions: [],
    linked_services: [],
    linked_promotions: [],
    active: true,
  });

  const { data: questionnaires = [], isLoading: loadingQuestionnaires } = useQuery({
    queryKey: ['questionnaires'],
    queryFn: async () => {
      const res = await questionnaireApi.getAll();
      return res.data;
    },
  });

  const { data: responses, isLoading: loadingResponses } = useQuery({
    queryKey: ['questionnaire-responses'],
    queryFn: async () => {
      const res = await questionnaireResponsesApi.getAll();
      return res.data;
    },
    enabled: activeTab === 'responses',
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await servicesApi.getAll();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Questionnaire) => {
      await questionnaireApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire created successfully');
      resetForm();
    },
    onError: () => toast.error('Failed to create questionnaire'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Questionnaire> }) => {
      await questionnaireApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire updated successfully');
      resetForm();
    },
    onError: () => toast.error('Failed to update questionnaire'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await questionnaireApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire deleted');
    },
    onError: () => toast.error('Failed to delete questionnaire'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger_type: 'manual',
      questions: [],
      linked_services: [],
      linked_promotions: [],
      active: true,
    });
    setEditingQuestionnaire(null);
    setShowCreateModal(false);
  };

  const handleOpenEdit = (questionnaire: any) => {
    setEditingQuestionnaire(questionnaire);
    setFormData(questionnaire);
    setShowCreateModal(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.description || formData.questions.length === 0) {
      toast.error('Please fill in all required fields and add at least one question');
      return;
    }

    if (editingQuestionnaire?.id) {
      updateMutation.mutate({ id: editingQuestionnaire.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
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
    setFormData({
      ...formData,
      questions: formData.questions.map(q => q.id === id ? { ...q, ...updates } : q),
    });
  };

  const removeQuestion = (id: string) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter(q => q.id !== id),
    });
  };

  const filteredResponses = responses?.filter((response: any) => {
    const matchesSearch = searchTerm === '' || 
      response.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.contact_phone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || response.questionnaire_type === filterType;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Questionnaires</h1>
          <p className="text-gray-600 mt-2">
            Create and manage questionnaires, view customer responses
          </p>
        </div>
        {activeTab === 'questionnaires' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Questionnaire
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('questionnaires')}
            className={`pb-3 border-b-2 font-medium transition-colors ${
              activeTab === 'questionnaires'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-5 h-5 inline mr-2" />
            Questionnaire Management
          </button>
          <button
            onClick={() => setActiveTab('responses')}
            className={`pb-3 border-b-2 font-medium transition-colors ${
              activeTab === 'responses'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-5 h-5 inline mr-2" />
            Customer Responses
          </button>
        </nav>
      </div>

      {/* Questionnaires Tab */}
      {activeTab === 'questionnaires' && (
        <div className="space-y-4">
          {loadingQuestionnaires ? (
            <div className="flex justify-center items-center h-64">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : questionnaires.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Questionnaires Yet</h3>
              <p className="text-gray-600 mb-6">Create your first questionnaire to start collecting customer information</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create First Questionnaire
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {questionnaires.map((q: any) => (
                <div key={q.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{q.name}</h3>
                      <p className="text-sm text-gray-600">{q.description}</p>
                    </div>
                    {q.active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Inactive</span>
                    )}
                  </div>
                  
                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div>Questions: {q.questions?.length || 0}</div>
                    <div>Trigger: {q.trigger_type}</div>
                    {q.linked_services && q.linked_services.length > 0 && (
                      <div>Linked Services: {q.linked_services.length}</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(q)}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2 text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this questionnaire?')) {
                          deleteMutation.mutate(q.id);
                        }
                      }}
                      className="px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Responses Tab */}
      {activeTab === 'responses' && (
        <div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by customer name or phone..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="anamnesis">Anamnesis</option>
                <option value="feedback">Feedback</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {loadingResponses ? (
            <div className="flex justify-center items-center h-64">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredResponses?.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>No questionnaire responses found</p>
                          </td>
                        </tr>
                      ) : (
                        filteredResponses?.map((response: any) => (
                          <tr 
                            key={response.id} 
                            className={`hover:bg-gray-50 cursor-pointer ${selectedResponse?.id === response.id ? 'bg-blue-50' : ''}`}
                            onClick={() => setSelectedResponse(response)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <User className="w-8 h-8 text-gray-400 mr-3" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{response.contact_name || 'Unknown'}</p>
                                  <p className="text-xs text-gray-500">{response.contact_phone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                response.questionnaire_type === 'anamnesis' ? 'bg-blue-100 text-blue-700' :
                                response.questionnaire_type === 'feedback' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {response.questionnaire_type}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center text-sm text-gray-600">
                                <Calendar className="w-4 h-4 mr-2" />
                                {new Date(response.created_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => setSelectedResponse(response)}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {selectedResponse ? (
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedResponse.questionnaire_name}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          Submitted on {new Date(selectedResponse.created_at).toLocaleDateString()} at{' '}
                          {new Date(selectedResponse.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        selectedResponse.questionnaire_type === 'anamnesis' ? 'bg-blue-100 text-blue-700' :
                        selectedResponse.questionnaire_type === 'feedback' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedResponse.questionnaire_type}
                      </span>
                    </div>

                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-lg">
                            {selectedResponse.contact_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{selectedResponse.contact_name || 'Unknown Customer'}</p>
                          <p className="text-sm text-gray-600">{selectedResponse.contact_phone}</p>
                          {selectedResponse.contact_email && (
                            <p className="text-sm text-gray-600">{selectedResponse.contact_email}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900">Responses</h3>
                      {selectedResponse.answers && Object.entries(selectedResponse.answers).map(([question, answer]: any, idx: number) => (
                        <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                          <p className="text-sm font-medium text-gray-700 mb-1">Q: {question}</p>
                          <p className="text-gray-900">A: {answer || 'No answer provided'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <FileText className="w-16 h-16 mb-4" />
                    <p className="text-lg">Select a response to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingQuestionnaire ? 'Edit Questionnaire' : 'Create Questionnaire'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Questionnaire Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Patient Medical History, Post-Service Feedback"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this questionnaire's purpose"
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trigger Type
                  </label>
                  <select
                    value={formData.trigger_type}
                    onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="manual">Manual</option>
                    <option value="first_booking">First Booking</option>
                    <option value="post_booking">Post Booking</option>
                    <option value="post_service">Post Service</option>
                    <option value="new_customer">New Customer</option>
                    <option value="no_show">No-Show</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              {/* Questions */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Questions</h3>
                  <button
                    onClick={addQuestion}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Question
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.questions.map((q, index) => (
                    <div key={q.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-sm font-medium text-gray-700">Question {index + 1}</h4>
                        <button
                          onClick={() => removeQuestion(q.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                          placeholder="Enter your question"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />

                        <div className="flex gap-4">
                          <select
                            value={q.type}
                            onChange={(e) => updateQuestion(q.id, { type: e.target.value as any })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="text">Text</option>
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="yes_no">Yes/No</option>
                          </select>

                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">Required</span>
                          </label>
                        </div>

                        {q.type === 'multiple_choice' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">
                              Options (comma-separated)
                            </label>
                            <input
                              type="text"
                              value={q.options?.join(', ') || ''}
                              onChange={(e) => updateQuestion(q.id, { 
                                options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) 
                              })}
                              placeholder="Option 1, Option 2, Option 3"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {formData.questions.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p>No questions added yet. Click "Add Question" to start building your questionnaire.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Services */}
              {formData.trigger_type === 'post_service' && services.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Linked Services</h3>
                  <div className="space-y-2">
                    {services.map((service: any) => (
                      <label key={service.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.linked_services?.includes(service.id)}
                          onChange={(e) => {
                            const linked = formData.linked_services || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, linked_services: [...linked, service.id] });
                            } else {
                              setFormData({ ...formData, linked_services: linked.filter(id => id !== service.id) });
                            }
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{service.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingQuestionnaire ? 'Update' : 'Create'} Questionnaire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Questionnaires;
