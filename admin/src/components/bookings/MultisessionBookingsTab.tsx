import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, X, Clock, CheckCircle, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface MultisessionConfig {
  id: string;
  contact_id: string;
  service_id: string;
  contact: {
    id: string;
    name: string;
    phone_number: string;
    email: string;
  };
  service: {
    id: string;
    name: string;
  };
  parent_booking: any;
  
  // Effective configuration
  effective_total_sessions: number;
  effective_strategy: string;
  effective_min_days_between: number;
  effective_max_days_between: number;
  effective_buffer_before: number;
  effective_buffer_after: number;
  
  // Customizations
  has_custom_config: boolean;
  custom_total_sessions: number | null;
  custom_strategy: string | null;
  custom_min_days_between_sessions: number | null;
  custom_max_days_between_sessions: number | null;
  custom_buffer_before_minutes: number | null;
  custom_buffer_after_minutes: number | null;
  custom_session_schedule: any | null;
  
  // Progress
  sessions_completed: number;
  sessions_scheduled: number;
  sessions_cancelled: number;
  status: string;
  completion_percentage: number;
  
  // Session bookings
  session_bookings: any[];
  
  // Metadata
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
}

const MultisessionBookingsTab = () => {
  const [editingConfig, setEditingConfig] = useState<MultisessionConfig | null>(null);
  const [formData, setFormData] = useState<any>({});

  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['multisession-bookings'],
    queryFn: async () => {
      const res = await axios.get('/api/multisession-bookings');
      return res.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await axios.put(`/api/multisession-bookings/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multisession-bookings'] });
      toast.success('Multi-session configuration updated successfully');
      setEditingConfig(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update configuration');
    }
  });

  const openEditModal = (config: MultisessionConfig) => {
    setEditingConfig(config);
    setFormData({
      is_active: true,
      custom_total_sessions: config.custom_total_sessions,
      custom_strategy: config.custom_strategy,
      custom_min_days_between_sessions: config.custom_min_days_between_sessions,
      custom_max_days_between_sessions: config.custom_max_days_between_sessions,
      custom_buffer_before_minutes: config.custom_buffer_before_minutes,
      custom_buffer_after_minutes: config.custom_buffer_after_minutes,
      status: config.status,
      notes: config.notes
    });
  };

  const closeEditModal = () => {
    setEditingConfig(null);
    setFormData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;

    updateMutation.mutate({
      id: editingConfig.id,
      data: formData
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeConfigs = (configs || []).filter((c: MultisessionConfig) => 
    c.status === 'active'
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Multi-Session Bookings</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage customers with multi-session treatment plans. Customize timing and buffer requirements per customer.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{activeConfigs.length}</div>
              <div className="text-xs text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {configs ? configs.reduce((sum: number, c: MultisessionConfig) => sum + c.sessions_completed, 0) : 0}
              </div>
              <div className="text-xs text-gray-500">Completed Sessions</div>
            </div>
          </div>
        </div>

        {configs && configs.length > 0 ? (
          <div className="space-y-4">
            {configs.map((config: MultisessionConfig) => (
              <div key={config.id} className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-gray-900 text-lg">{config.contact.name}</h3>
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                        {config.service.name}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        config.status === 'active' ? 'bg-green-100 text-green-700' :
                        config.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                        config.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {config.status}
                      </span>
                      {config.has_custom_config && (
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full font-medium">
                          ✨ Custom Config
                        </span>
                      )}
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-700">Progress:</span>
                        <span className="text-sm text-gray-900">
                          {config.sessions_completed} / {config.effective_total_sessions} sessions completed
                        </span>
                        <span className="text-sm text-green-600 font-medium">
                          ({config.completion_percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${config.completion_percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Strategy</p>
                        <p className="text-sm font-medium text-gray-900">
                          {config.effective_strategy}
                          {config.custom_strategy && (
                            <span className="text-xs text-purple-600 ml-1">(Custom)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Days Between Sessions</p>
                        <p className="text-sm font-medium text-gray-900">
                          {config.effective_min_days_between}-{config.effective_max_days_between} days
                          {(config.custom_min_days_between_sessions || config.custom_max_days_between_sessions) && (
                            <span className="text-xs text-purple-600 ml-1">(Custom)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Buffer Times</p>
                        <p className="text-sm font-medium text-gray-900">
                          Before: {config.effective_buffer_before}min, After: {config.effective_buffer_after}min
                          {(config.custom_buffer_before_minutes || config.custom_buffer_after_minutes) && (
                            <span className="text-xs text-purple-600 ml-1">(Custom)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Status Breakdown</p>
                        <p className="text-sm font-medium text-gray-900">
                          <span className="text-green-600">{config.sessions_completed} ✓</span>,{' '}
                          <span className="text-blue-600">{config.sessions_scheduled} 📅</span>,{' '}
                          <span className="text-red-600">{config.sessions_cancelled} ✗</span>
                        </p>
                      </div>
                    </div>

                    {config.session_bookings && config.session_bookings.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-700 mb-2">Session Schedule:</p>
                        <div className="flex flex-wrap gap-2">
                          {config.session_bookings.map((booking: any, idx: number) => (
                            <div
                              key={booking.id}
                              className={`px-2 py-1 text-xs rounded ${
                                booking.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' :
                                booking.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                booking.status === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200' :
                                'bg-gray-50 text-gray-700 border border-gray-200'
                              }`}
                            >
                              Session {booking.session_number}: {new Date(booking.scheduled_time).toLocaleDateString()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {config.notes && (
                      <div className="mt-3 text-xs text-gray-600 italic bg-gray-50 p-2 rounded">
                        {config.notes}
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    <button
                      onClick={() => openEditModal(config)}
                      className="px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Config
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Multi-Session Bookings</h3>
            <p className="text-sm text-gray-500">
              Multi-session bookings are created when customers book services requiring multiple sessions.
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">
                Edit Multi-Session Config for {editingConfig.contact.name}
              </h2>
              <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Service:</strong> {editingConfig.service.name}<br />
                  <strong>Service Defaults:</strong> {editingConfig.service.name} multi-session settings<br />
                  <strong>Progress:</strong> {editingConfig.sessions_completed} / {editingConfig.effective_total_sessions} sessions
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Total Sessions - Leave empty to use service default
                </label>
                <input
                  type="number"
                  value={formData.custom_total_sessions || ''}
                  onChange={(e) => setFormData({ ...formData, custom_total_sessions: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={`Service default`}
                  min="1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Days Between Sessions
                  </label>
                  <input
                    type="number"
                    value={formData.custom_min_days_between_sessions || ''}
                    onChange={(e) => setFormData({ ...formData, custom_min_days_between_sessions: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Service default"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Days Between Sessions
                  </label>
                  <input
                    type="number"
                    value={formData.custom_max_days_between_sessions || ''}
                    onChange={(e) => setFormData({ ...formData, custom_max_days_between_sessions: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Service default"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buffer Before (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.custom_buffer_before_minutes || ''}
                    onChange={(e) => setFormData({ ...formData, custom_buffer_before_minutes: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Service default"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buffer After (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.custom_buffer_after_minutes || ''}
                    onChange={(e) => setFormData({ ...formData, custom_buffer_after_minutes: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Service default"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes about this customer's multi-session treatment..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultisessionBookingsTab;
