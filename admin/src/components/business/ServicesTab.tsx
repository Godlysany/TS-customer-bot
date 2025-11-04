import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '../../lib/api';
import { Plus, Edit, Trash2, Clock, DollarSign, Calendar, Save, X, FileText } from 'lucide-react';
import DocumentUpload from '../shared/DocumentUpload';

interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  cost: number;
  bufferTimeBefore: number;
  bufferTimeAfter: number;
  color: string;
  isActive: boolean;
  alwaysFollowBusinessHours?: boolean;
  requiresPayment: boolean;
  depositAmount: number;
  maxAdvanceBookingDays: number;
  cancellationPolicyHours: number;
  cancellationPenaltyAmount: number;
  cancellationPenaltyType: 'fixed' | 'percentage';
  requiresMultipleSessions?: boolean;
  totalSessionsRequired?: number;
  multiSessionStrategy?: 'immediate' | 'sequential' | 'flexible';
  sessionBufferConfig?: any;
  recurringReminderEnabled?: boolean;
  recurringIntervalDays?: number;
  recurringReminderDaysBefore?: number;
  recurringReminderMessage?: string;
  documentUrl?: string | null;
  documentName?: string | null;
  documentTiming?: string | null;
  documentDescription?: string | null;
  documentStoragePath?: string | null;
  documentKeywords?: string[] | null;
}

const ServicesTab = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<Partial<Service>>({});
  const queryClient = useQueryClient();

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await servicesApi.getAll();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Service>) => servicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Service> }) =>
      servicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const openModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData(service);
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        description: '',
        durationMinutes: 30,
        cost: 0,
        bufferTimeBefore: 0,
        bufferTimeAfter: 10,
        color: '#3B82F6',
        isActive: true,
        alwaysFollowBusinessHours: true,
        requiresPayment: false,
        depositAmount: 0,
        maxAdvanceBookingDays: 90,
        cancellationPolicyHours: 24,
        cancellationPenaltyAmount: 0,
        cancellationPenaltyType: 'fixed',
        requiresMultipleSessions: false,
        totalSessionsRequired: 1,
        multiSessionStrategy: 'flexible',
        sessionBufferConfig: { default_days: 7 },
        recurringReminderEnabled: false,
        recurringIntervalDays: 365,
        recurringReminderDaysBefore: 14,
        recurringReminderMessage: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setFormData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Management</h1>
          <p className="text-gray-600 mt-2">
            Configure bookable services with durations, pricing, and buffer times
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Service
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services?.map((service: Service) => (
            <div
              key={service.id}
              className="bg-white rounded-lg shadow-sm border-2 border-gray-200 hover:shadow-md transition-shadow"
              style={{ borderTopColor: service.color, borderTopWidth: '4px' }}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      service.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {service.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{service.durationMinutes} min</span>
                    {(service.bufferTimeBefore > 0 || service.bufferTimeAfter > 0) && (
                      <span className="text-xs text-gray-500">
                        (Buffer: {service.bufferTimeBefore + service.bufferTimeAfter} min)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <DollarSign className="w-4 h-4" />
                    <span>CHF {service.cost.toFixed(2)}</span>
                    {service.requiresPayment && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        Payment Required
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Book up to {service.maxAdvanceBookingDays} days ahead</span>
                  </div>
                  {service.documentUrl && (
                    <div className="flex items-center gap-2 text-sm text-purple-600">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        Has Document ({service.documentTiming || 'on_confirmation'})
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(service)}
                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete service "${service.name}"?`)) {
                        deleteMutation.mutate(service.id);
                      }
                    }}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingService ? 'Edit Service' : 'New Service'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes) *
                  </label>
                  <input
                    type="number"
                    value={formData.durationMinutes || 30}
                    onChange={(e) =>
                      setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    min="5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cost (CHF) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost || 0}
                    onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buffer Before (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.bufferTimeBefore || 0}
                    onChange={(e) =>
                      setFormData({ ...formData, bufferTimeBefore: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Prep time before appointment</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buffer After (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.bufferTimeAfter || 0}
                    onChange={(e) =>
                      setFormData({ ...formData, bufferTimeAfter: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Cleanup time after appointment</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Advance Booking (days)
                  </label>
                  <input
                    type="number"
                    value={formData.maxAdvanceBookingDays || 90}
                    onChange={(e) =>
                      setFormData({ ...formData, maxAdvanceBookingDays: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color || '#3B82F6'}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full h-10 px-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requiresPayment || false}
                      onChange={(e) =>
                        setFormData({ ...formData, requiresPayment: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Require Payment Before Booking
                    </label>
                  </div>
                </div>

                {formData.requiresPayment && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deposit Amount (CHF)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.depositAmount || 0}
                      onChange={(e) =>
                        setFormData({ ...formData, depositAmount: parseFloat(e.target.value) })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cancellation Policy (hours)
                  </label>
                  <input
                    type="number"
                    value={formData.cancellationPolicyHours || 24}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cancellationPolicyHours: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Penalty Amount (CHF)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cancellationPenaltyAmount || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cancellationPenaltyAmount: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Service is Active (available for booking)
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={formData.alwaysFollowBusinessHours !== false}
                      onChange={(e) => setFormData({ ...formData, alwaysFollowBusinessHours: e.target.checked })}
                      className="w-4 h-4 text-blue-600 mt-0.5"
                    />
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Always follow business hours
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        When enabled, appointments for this service can only be booked within the business opening hours configured in Business Details. Prevents bookings during closed periods or break times (e.g., lunch breaks).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Multi-Session Booking Configuration</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure this service for treatments requiring multiple appointments (e.g., dental implants, driving lessons, physiotherapy plans)
                </p>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.requiresMultipleSessions || false}
                        onChange={(e) =>
                          setFormData({ ...formData, requiresMultipleSessions: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600"
                      />
                      <label className="text-sm font-medium text-gray-700">
                        This service requires multiple sessions
                      </label>
                    </div>
                  </div>

                  {formData.requiresMultipleSessions && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2 border-blue-200">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Total Sessions Required *
                          </label>
                          <input
                            type="number"
                            value={formData.totalSessionsRequired || 1}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                totalSessionsRequired: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                            min="1"
                            max="50"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            How many sessions total (e.g., 3 for dental implant, 10 for driving lessons)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Booking Strategy *
                          </label>
                          <select
                            value={formData.multiSessionStrategy || 'flexible'}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                multiSessionStrategy: e.target.value as
                                  | 'immediate'
                                  | 'sequential'
                                  | 'flexible',
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="immediate">Immediate - Book all sessions upfront</option>
                            <option value="sequential">Sequential - Book one at a time after completion</option>
                            <option value="flexible">Flexible - Customer chooses how many to book</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            {formData.multiSessionStrategy === 'immediate' &&
                              'All sessions booked at once (e.g., dental implant with fixed healing periods)'}
                            {formData.multiSessionStrategy === 'sequential' &&
                              'Next session booked after previous one completes (e.g., physiotherapy)'}
                            {formData.multiSessionStrategy === 'flexible' &&
                              'Customer decides how many to schedule (e.g., driving lesson packages)'}
                          </p>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Buffer Time Between Sessions (days)
                          </label>
                          {formData.multiSessionStrategy === 'immediate' ? (
                            <div className="space-y-3">
                              <p className="text-xs text-gray-600">
                                For immediate strategy, you can set specific buffer times between each session or use a default.
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Session 1 → 2 (days)
                                  </label>
                                  <input
                                    type="number"
                                    value={formData.sessionBufferConfig?.session_1_to_2_days || 7}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        sessionBufferConfig: {
                                          ...formData.sessionBufferConfig,
                                          session_1_to_2_days: parseInt(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    min="0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Session 2 → 3 (days)
                                  </label>
                                  <input
                                    type="number"
                                    value={formData.sessionBufferConfig?.session_2_to_3_days || 7}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        sessionBufferConfig: {
                                          ...formData.sessionBufferConfig,
                                          session_2_to_3_days: parseInt(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    min="0"
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 italic">
                                Add more specific buffers as needed for your treatment plan
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Minimum Days
                                  </label>
                                  <input
                                    type="number"
                                    value={formData.sessionBufferConfig?.minimum_days || 0}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        sessionBufferConfig: {
                                          ...formData.sessionBufferConfig,
                                          minimum_days: parseInt(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    min="0"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Sessions must be at least this many days apart
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Recommended Days
                                  </label>
                                  <input
                                    type="number"
                                    value={formData.sessionBufferConfig?.recommended_days || 7}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        sessionBufferConfig: {
                                          ...formData.sessionBufferConfig,
                                          recommended_days: parseInt(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    min="0"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Bot will suggest this interval
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg">
                          <h4 className="text-sm font-semibold text-blue-900 mb-2">How it works:</h4>
                          <div className="text-sm text-blue-800 space-y-1">
                            {formData.multiSessionStrategy === 'immediate' && (
                              <>
                                <p>✓ Bot books all {formData.totalSessionsRequired} sessions upfront</p>
                                <p>✓ Sessions automatically spaced based on buffer config</p>
                                <p>✓ Customer sees complete treatment schedule</p>
                                <p>✓ All sessions linked together with group ID</p>
                              </>
                            )}
                            {formData.multiSessionStrategy === 'sequential' && (
                              <>
                                <p>✓ Bot books first session only</p>
                                <p>✓ After completion, automatically prompts for next session</p>
                                <p>✓ Progress tracked: "Session 3 of {formData.totalSessionsRequired}"</p>
                                <p>✓ Flexible timing based on customer availability</p>
                              </>
                            )}
                            {formData.multiSessionStrategy === 'flexible' && (
                              <>
                                <p>✓ Customer decides how many sessions to book at once</p>
                                <p>✓ Can book 1, 5, or all {formData.totalSessionsRequired} sessions</p>
                                <p>✓ Progress tracked: "5 of {formData.totalSessionsRequired} booked"</p>
                                <p>✓ Full control and flexibility for customer</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recurring Service Reminders</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Automatically remind customers when it's time for their next recurring appointment (e.g., yearly dental checkup, quarterly maintenance)
                </p>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.recurringReminderEnabled || false}
                        onChange={(e) =>
                          setFormData({ ...formData, recurringReminderEnabled: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600"
                      />
                      <label className="text-sm font-medium text-gray-700">
                        Enable automatic recurring reminders for this service
                      </label>
                    </div>
                  </div>

                  {formData.recurringReminderEnabled && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-6 border-l-2 border-green-200">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Recurrence Interval (days) *
                          </label>
                          <input
                            type="number"
                            value={formData.recurringIntervalDays || 365}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                recurringIntervalDays: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            min="1"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            365 = yearly, 90 = quarterly, 30 = monthly
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Remind X days before due *
                          </label>
                          <input
                            type="number"
                            value={formData.recurringReminderDaysBefore || 14}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                recurringReminderDaysBefore: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            min="0"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Start reminding customer this many days before next due date
                          </p>
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Custom Reminder Message (optional)
                          </label>
                          <textarea
                            value={formData.recurringReminderMessage || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                recurringReminderMessage: e.target.value,
                              })
                            }
                            placeholder="Hi {{name}}! It's been a while since your last {{service}}. Based on our recommended schedule, it's time to book your next appointment. Would you like to schedule one?"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            rows={3}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Available placeholders: {`{{name}}, {{service}}, {{last_date}}, {{next_date}}`}
                          </p>
                        </div>
                      </div>

                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="text-sm font-semibold text-green-900 mb-2">How it works:</h4>
                        <div className="text-sm text-green-800 space-y-1">
                          <p>✓ System tracks completed appointments for this service</p>
                          <p>✓ Calculates next due date based on {formData.recurringIntervalDays} day interval</p>
                          <p>✓ Automatically sends WhatsApp reminder {formData.recurringReminderDaysBefore} days before due date</p>
                          <p>✓ Prevents duplicate reminders (won't send if already reminded within 7 days)</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Document</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Optionally attach a document (PDF, image, etc.) to automatically share with customers at specific timing
                </p>

                <div className="space-y-4">
                  <DocumentUpload
                    currentDocument={
                      formData.documentUrl
                        ? {
                            url: formData.documentUrl,
                            name: formData.documentName || 'Document',
                            timing: formData.documentTiming || undefined,
                            description: formData.documentDescription || undefined,
                          }
                        : null
                    }
                    onUploadComplete={(data) => {
                      setFormData({
                        ...formData,
                        documentUrl: data.url,
                        documentName: data.fileName,
                        documentStoragePath: data.storagePath,
                      });
                    }}
                    onRemove={() => {
                      setFormData({
                        ...formData,
                        documentUrl: null,
                        documentName: null,
                        documentStoragePath: null,
                        documentTiming: null,
                        documentDescription: null,
                      });
                    }}
                  />

                  {formData.documentUrl && (
                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          When to send this document *
                        </label>
                        <select
                          value={formData.documentTiming || 'on_confirmation'}
                          onChange={(e) =>
                            setFormData({ ...formData, documentTiming: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="as_info">As Info (Send immediately during conversation)</option>
                          <option value="on_confirmation">On Confirmation (After booking confirmed)</option>
                          <option value="after_booking">After Booking (After appointment completed)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Document Description (optional)
                        </label>
                        <textarea
                          value={formData.documentDescription || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, documentDescription: e.target.value })
                          }
                          placeholder="E.g., Preparation guidelines for your appointment"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          rows={2}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Optional message to send with the document (will be personalized with GPT)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Trigger Keywords (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={Array.isArray(formData.documentKeywords) ? formData.documentKeywords.join(', ') : ''}
                          onBlur={(e) => {
                            // Only process when user leaves the field
                            const keywords = e.target.value
                              .split(',')
                              .map(k => k.trim())
                              .filter(k => k.length > 0);
                            setFormData({ ...formData, documentKeywords: keywords });
                          }}
                          onChange={(e) => {
                            // Allow free typing, store as temp string
                            const value = e.target.value;
                            setFormData({ ...formData, documentKeywords: value as any });
                          }}
                          placeholder="E.g., preparation, guidelines, instructions, what to bring"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Bot will send this document when customer mentions these keywords (only for "as_info" timing)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesTab;
