import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customersApi, nurturingApi } from '../lib/api';
import { ArrowLeft, Mail, Phone, Calendar, MessageSquare, FileText, TrendingUp, Heart, ClipboardList, User, Clock, Activity, DollarSign } from 'lucide-react';
import PaymentHistory from '../components/PaymentHistory';

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'payments' | 'questionnaires' | 'nurturing'>('overview');

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
            
            {(customer?.sentiment_score !== null && customer?.sentiment_score !== undefined) || (customer?.keywords && customer.keywords.length > 0) || customer?.upsell_potential ? (
              <div className="space-y-6">
                {(customer?.sentiment_score !== null && customer?.sentiment_score !== undefined) && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Customer Sentiment</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      customer.sentiment_score >= 0.3 ? 'bg-green-100 text-green-700' :
                      customer.sentiment_score >= -0.3 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {customer.sentiment_score >= 0.3 ? '😊 Positive' : customer.sentiment_score >= -0.3 ? '😐 Neutral' : '😞 Negative'}
                      <span className="ml-2 text-xs opacity-75">({customer.sentiment_score.toFixed(2)})</span>
                    </span>
                  </div>
                )}

                {customer?.keywords && customer.keywords.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Common Keywords</p>
                    <div className="flex flex-wrap gap-2">
                      {customer.keywords.map((keyword: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {customer?.upsell_potential && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-700">High upsell potential detected</span>
                  </div>
                )}
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
