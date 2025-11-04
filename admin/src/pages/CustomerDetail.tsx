import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, nurturingApi, analyticsApi } from '../lib/api';
import { ArrowLeft, Mail, Phone, Calendar, MessageSquare, FileText, TrendingUp, Heart, ClipboardList, User, Clock, Activity, DollarSign, Edit, Save, Bot, AlertTriangle, CheckCircle, Languages } from 'lucide-react';
import PaymentHistory from '../components/PaymentHistory';
import toast from 'react-hot-toast';

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'payments' | 'questionnaires' | 'nurturing'>('overview');
  const [isEditingNurturing, setIsEditingNurturing] = useState(false);
  const [birthdateEdit, setBirthdateEdit] = useState('');
  const [emailEdit, setEmailEdit] = useState('');
  const [languageEdit, setLanguageEdit] = useState('');
  const [botEnabledEdit, setBotEnabledEdit] = useState(true);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await customersApi.getById(id!);
      return res.data;
    },
  });

  const { data: questionnaires } = useQuery({
    queryKey: ['customer-questionnaires', id],
    queryFn: async () => {
      const res = await customersApi.getQuestionnaires(id!);
      return res.data;
    },
  });

  const { data: serviceHistory } = useQuery({
    queryKey: ['customer-service-history', id],
    queryFn: async () => {
      const res = await customersApi.getServiceHistory(id!);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: nurturingActivities } = useQuery({
    queryKey: ['customer-nurturing-activities', id],
    queryFn: async () => {
      const res = await nurturingApi.getContactActivities(id!, 20);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: sentimentData } = useQuery({
    queryKey: ['customer-sentiment', id],
    queryFn: async () => {
      const res = await analyticsApi.getSentiment(id!);
      return res.data;
    },
    enabled: !!id,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (preferences: any) => nurturingApi.updateContactPreferences(id!, preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setIsEditingNurturing(false);
      toast.success('Nurturing preferences updated successfully');
    },
    onError: () => {
      toast.error('Failed to update preferences');
    },
  });

  const handleStartEdit = () => {
    setBirthdateEdit(customer?.birthdate || '');
    setEmailEdit(customer?.email || '');
    setLanguageEdit(customer?.preferred_language || '');
    setBotEnabledEdit(customer?.bot_enabled !== false);
    setIsEditingNurturing(true);
  };

  const handleSaveNurturing = () => {
    updatePreferencesMutation.mutate({
      birthdate: birthdateEdit || null,
      email: emailEdit || null,
      preferredLanguage: languageEdit || null,
      botEnabled: botEnabledEdit,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link to="/customers" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Customers
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">
                    {customer?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl font-bold text-gray-900">{customer?.name || 'Unknown Customer'}</h1>
                  <p className="text-gray-500">Customer since {new Date(customer?.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {customer?.phone_number && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{customer.phone_number}</p>
                  </div>
                </div>
              )}
              {customer?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900">{customer.email}</p>
                  </div>
                </div>
              )}
              {customer?.birthdate && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Birthday</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(customer.birthdate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
              {customer?.preferred_language && (
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Language Preference</p>
                    <p className="text-sm font-medium text-gray-900">
                      {customer.preferred_language === 'de' ? '🇩🇪 German (Deutsch)' : 
                       customer.preferred_language === 'en' ? '🇬🇧 English' :
                       customer.preferred_language === 'fr' ? '🇫🇷 French (Français)' :
                       customer.preferred_language}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-4 px-6">
                {[
                  { id: 'overview', label: 'Analytics', icon: TrendingUp },
                  { id: 'history', label: 'Service History', icon: ClipboardList },
                  { id: 'payments', label: 'Payments', icon: DollarSign },
                  { id: 'questionnaires', label: 'Questionnaires', icon: FileText },
                  { id: 'nurturing', label: 'Nurturing', icon: Heart }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Analytics & Insights</h2>
            
            {/* Escalation Warning Banner */}
            {sentimentData && (sentimentData.escalationStatus === 'pending' || sentimentData.escalationStatus === 'escalated') && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-900">Conversation Escalated</h3>
                    <p className="text-sm text-red-700 mt-1">
                      {sentimentData.escalationReason || 'This conversation has been escalated and requires immediate attention.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sentiment Analytics Section */}
            {sentimentData ? (
              <div className="space-y-6">
                {/* Overall Sentiment Score */}
                <div>
                  <p className="text-sm text-gray-500 mb-2">Overall Sentiment</p>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      sentimentData.sentimentScore >= 0.3 ? 'bg-green-100 text-green-700' :
                      sentimentData.sentimentScore >= -0.3 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {sentimentData.sentimentScore >= 0.3 ? '😊 Positive' : 
                       sentimentData.sentimentScore >= -0.3 ? '😐 Neutral' : 
                       '😞 Negative'}
                      <span className="ml-2 text-xs opacity-75">({sentimentData.sentimentScore.toFixed(2)})</span>
                    </span>
                    {sentimentData.sentimentTrend && sentimentData.sentimentTrend !== 'stable' && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        sentimentData.sentimentTrend === 'improving' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {sentimentData.sentimentTrend === 'improving' ? '↗ Improving' : '↘ Declining'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Frustration & Confusion Levels */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">Frustration Level</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        sentimentData.frustrationLevel >= 0.8 ? 'bg-red-100 text-red-700' :
                        sentimentData.frustrationLevel >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {(sentimentData.frustrationLevel * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          sentimentData.frustrationLevel >= 0.8 ? 'bg-red-600' :
                          sentimentData.frustrationLevel >= 0.5 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${sentimentData.frustrationLevel * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">Confusion Level</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        sentimentData.confusionLevel >= 0.7 ? 'bg-red-100 text-red-700' :
                        sentimentData.confusionLevel >= 0.4 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {(sentimentData.confusionLevel * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          sentimentData.confusionLevel >= 0.7 ? 'bg-red-600' :
                          sentimentData.confusionLevel >= 0.4 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${sentimentData.confusionLevel * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Language Status */}
                {sentimentData.language && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Languages className="w-4 h-4 text-gray-600" />
                      <h3 className="font-medium text-gray-900">Language Preferences</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Preferred Language</p>
                        <p className="font-medium text-gray-900">
                          {sentimentData.language.preferred ? sentimentData.language.preferred.toUpperCase() : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Confirmation Status</p>
                        <div className="flex items-center gap-1">
                          {sentimentData.language.confirmed ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-green-700">Confirmed</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-600">Not confirmed</span>
                            </>
                          )}
                        </div>
                      </div>
                      {sentimentData.language.pending && (
                        <div className="col-span-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                          Pending language change to: {sentimentData.language.pending.toUpperCase()}
                        </div>
                      )}
                      {sentimentData.language.confirmationDate && (
                        <div className="col-span-2">
                          <p className="text-gray-500 text-xs">Confirmed on</p>
                          <p className="text-gray-900 text-xs">
                            {new Date(sentimentData.language.confirmationDate).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Last Analysis Time */}
                {sentimentData.lastAnalysis && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last analyzed: {new Date(sentimentData.lastAnalysis).toLocaleString()}
                  </div>
                )}

                {/* Legacy Analytics Data */}
                {(() => {
                  const keywords = customer?.analytics?.keywords ?? customer?.keywords;
                  const upsellPotential = customer?.analytics?.upsell_potential ?? customer?.upsell_potential;
                  const hasKeywords = keywords && keywords.length > 0;
                  const hasUpsell = upsellPotential;

                  return (hasKeywords || hasUpsell) ? (
                    <div className="border-t border-gray-200 pt-6 space-y-4">
                      {hasKeywords && (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Common Keywords</p>
                          <div className="flex flex-wrap gap-2">
                            {keywords.map((keyword: string, idx: number) => (
                              <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {hasUpsell && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <TrendingUp className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-700">High upsell potential detected</span>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No analytics data available yet</p>
                <p className="text-sm text-gray-400 mt-1">Analytics will appear as the customer interacts with your business</p>
              </div>
            )}
                </div>
              )}

              {activeTab === 'history' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    Service History
                  </h2>
            
            {serviceHistory && serviceHistory.length > 0 ? (
              <div className="space-y-3">
                {serviceHistory.map((booking: any) => (
                  <div key={booking.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{booking.service?.name || 'Service'}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(booking.scheduledTime).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })} at {new Date(booking.scheduledTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded font-medium ${
                        booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                        booking.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-3">
                      {booking.service?.durationMinutes && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{booking.service.durationMinutes} min</span>
                        </div>
                      )}
                      {booking.teamMember && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{booking.teamMember.name}</span>
                        </div>
                      )}
                      {booking.cost && (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">CHF {booking.cost}</span>
                        </div>
                      )}
                    </div>
                    
                    {booking.notes && (
                      <p className="text-xs text-gray-600 mt-2 italic bg-gray-50 p-2 rounded">
                        {booking.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No service history yet</p>
            )}
                </div>
              )}

              {activeTab === 'payments' && id && (
                <PaymentHistory customerId={id} />
              )}

              {activeTab === 'questionnaires' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Questionnaire Responses
                  </h2>
            
            {questionnaires && questionnaires.length > 0 ? (
              <div className="space-y-4">
                {questionnaires.map((response: any) => (
                  <div key={response.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{response.questionnaire_name}</h3>
                        <p className="text-xs text-gray-500">
                          {new Date(response.created_at).toLocaleDateString()} at {new Date(response.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        {response.questionnaire_type}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {response.answers && Object.entries(response.answers).map(([question, answer]: any) => (
                        <div key={question} className="text-sm">
                          <p className="text-gray-600 font-medium">Q: {question}</p>
                          <p className="text-gray-900 ml-4">A: {answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No questionnaire responses yet</p>
            )}
                </div>
              )}

              {activeTab === 'nurturing' && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-500" />
                        Nurturing Preferences
                      </h3>
                      {!isEditingNurturing ? (
                        <button
                          onClick={handleStartEdit}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsEditingNurturing(false)}
                            className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveNurturing}
                            disabled={updatePreferencesMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                        {isEditingNurturing ? (
                          <input
                            type="date"
                            value={birthdateEdit}
                            onChange={(e) => setBirthdateEdit(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <p className="text-sm text-gray-900">
                            {customer?.birthdate 
                              ? new Date(customer.birthdate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                              : 'Not set'}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        {isEditingNurturing ? (
                          <input
                            type="email"
                            value={emailEdit}
                            onChange={(e) => setEmailEdit(e.target.value)}
                            placeholder="customer@example.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <p className="text-sm text-gray-900">{customer?.email || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Language Preference</label>
                        {isEditingNurturing ? (
                          <select
                            value={languageEdit}
                            onChange={(e) => setLanguageEdit(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Auto-detect</option>
                            <option value="de">German (DE)</option>
                            <option value="fr">French (FR)</option>
                            <option value="it">Italian (IT)</option>
                            <option value="en">English (EN)</option>
                          </select>
                        ) : (
                          <p className="text-sm text-gray-900">
                            {customer?.preferred_language 
                              ? customer.preferred_language.toUpperCase()
                              : 'Auto-detect'}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Bot className="w-4 h-4" />
                          Bot Auto-Reply Enabled
                        </label>
                        {isEditingNurturing ? (
                          <button
                            onClick={() => setBotEnabledEdit(!botEnabledEdit)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              botEnabledEdit ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              botEnabledEdit ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        ) : (
                          <p className="text-sm text-gray-900">
                            {customer?.bot_enabled !== false ? (
                              <span className="text-green-600 font-medium">Enabled</span>
                            ) : (
                              <span className="text-red-600 font-medium">Disabled</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-500" />
                      Nurturing Activities
                    </h2>
                    
                    {nurturingActivities && nurturingActivities.length > 0 ? (
                      <div className="space-y-2">
                        {nurturingActivities.map((activity: any) => (
                          <div key={activity.id} className="border-l-4 border-purple-200 bg-purple-50 p-3 rounded">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900 capitalize">
                                {activity.activityType.replace(/_/g, ' ')}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                                activity.status === 'completed' ? 'bg-green-100 text-green-700' :
                                activity.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                activity.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {activity.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600">
                              {new Date(activity.createdAt).toLocaleDateString()} at {new Date(activity.createdAt).toLocaleTimeString()}
                            </p>
                            {activity.messageContent && (
                              <p className="text-xs text-gray-700 mt-2 italic">{activity.messageContent}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No nurturing activities yet</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Conversations</span>
                </div>
                <span className="font-semibold text-gray-900">{customer?.conversation_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Bookings</span>
                </div>
                <span className="font-semibold text-gray-900">{customer?.booking_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Questionnaires</span>
                </div>
                <span className="font-semibold text-gray-900">{questionnaires?.length || 0}</span>
              </div>
            </div>
          </div>

          {customer?.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Important Notes
              </h3>
              <p className="text-sm text-amber-800">{customer.notes}</p>
            </div>
          )}

          <Link
            to="/conversations"
            state={{ preSelectContact: customer?.id }}
            className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            View Conversations
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetail;
