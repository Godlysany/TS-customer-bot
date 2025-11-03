import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, X, Clock, History } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface RecurringReminder {
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
    recurring_interval_days: number;
    recurring_reminder_days_before: number;
    recurring_reminder_message: string;
  };
  last_booking: any;
  
  // Effective configuration
  effective_interval_days: number;
  effective_reminder_days_before: number;
  effective_message: string;
  
  // Customizations
  has_custom_interval: boolean;
  has_custom_reminder_days: boolean;
  has_custom_message: boolean;
  custom_interval_days: number | null;
  custom_reminder_days_before: number | null;
  custom_message: string | null;
  
  // Metadata
  is_active: boolean;
  last_reminder_sent_at: string | null;
  next_reminder_due_at: string | null;
  last_completed_booking_at: string | null;
  total_reminders_sent: number;
  total_bookings_completed: number;
}

const RecurringRemindersTab = () => {
  const [editingReminder, setEditingReminder] = useState<RecurringReminder | null>(null);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    is_active: boolean;
    custom_interval_days: number | null;
    custom_reminder_days_before: number | null;
    custom_message: string | null;
  }>({
    is_active: true,
    custom_interval_days: null,
    custom_reminder_days_before: null,
    custom_message: null
  });

  const queryClient = useQueryClient();

  const { data: reminders, isLoading } = useQuery({
    queryKey: ['recurring-reminders'],
    queryFn: async () => {
      const res = await axios.get('/api/recurring-reminders');
      return res.data;
    }
  });

  const { data: reminderHistory } = useQuery({
    queryKey: ['recurring-reminder-history', viewingHistory],
    queryFn: async () => {
      const res = await axios.get(`/api/recurring-reminders/${viewingHistory}/history`);
      return res.data.history;
    },
    enabled: !!viewingHistory
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await axios.put(`/api/recurring-reminders/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-reminders'] });
      toast.success('Recurring reminder updated successfully');
      setEditingReminder(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update reminder');
    }
  });

  const openEditModal = (reminder: RecurringReminder) => {
    setEditingReminder(reminder);
    setFormData({
      is_active: reminder.is_active,
      custom_interval_days: reminder.custom_interval_days,
      custom_reminder_days_before: reminder.custom_reminder_days_before,
      custom_message: reminder.custom_message
    });
  };

  const closeEditModal = () => {
    setEditingReminder(null);
    setFormData({
      is_active: true,
      custom_interval_days: null,
      custom_reminder_days_before: null,
      custom_message: null
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder) return;

    updateMutation.mutate({
      id: editingReminder.id,
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

  const upcomingReminders = (reminders || []).filter((r: RecurringReminder) => 
    r.is_active && r.next_reminder_due_at
  );

  const activeCount = (reminders || []).filter((r: RecurringReminder) => r.is_active).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recurring Service Reminders</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage customer-specific recurring service reminder schedules. Customize interval and messaging per customer.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{activeCount}</div>
              <div className="text-xs text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{upcomingReminders.length}</div>
              <div className="text-xs text-gray-500">Upcoming</div>
            </div>
          </div>
        </div>

        {reminders && reminders.length > 0 ? (
          <div className="space-y-3">
            {reminders.map((reminder: RecurringReminder) => (
              <div key={reminder.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{reminder.contact.name}</h3>
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                        {reminder.service.name}
                      </span>
                      {!reminder.is_active && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                          Inactive
                        </span>
                      )}
                      {(reminder.has_custom_interval || reminder.has_custom_reminder_days || reminder.has_custom_message) && (
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full font-medium">
                          ✨ Customized
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-gray-500">Interval</p>
                        <p className="text-sm font-medium text-gray-900">
                          Every {reminder.effective_interval_days} days
                          {reminder.has_custom_interval && (
                            <span className="text-xs text-purple-600 ml-1">(Custom)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Reminder Before</p>
                        <p className="text-sm font-medium text-gray-900">
                          {reminder.effective_reminder_days_before} days
                          {reminder.has_custom_reminder_days && (
                            <span className="text-xs text-purple-600 ml-1">(Custom)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Next Reminder Due</p>
                        <p className="text-sm font-medium text-gray-900">
                          {reminder.next_reminder_due_at
                            ? new Date(reminder.next_reminder_due_at).toLocaleDateString()
                            : 'Not scheduled'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Bookings</p>
                        <p className="text-sm font-medium text-green-600">
                          {reminder.total_bookings_completed} completed
                        </p>
                      </div>
                    </div>

                    {reminder.last_completed_booking_at && (
                      <div className="mt-3 text-xs text-gray-500">
                        Last booking: {new Date(reminder.last_completed_booking_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setViewingHistory(reminder.id)}
                      className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                    >
                      <History className="w-4 h-4" />
                      History
                    </button>
                    <button
                      onClick={() => openEditModal(reminder)}
                      className="px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Recurring Reminders</h3>
            <p className="text-sm text-gray-500">
              Recurring reminders are created automatically when customers book services with recurring enabled.
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingReminder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">
                Edit Recurring Reminder for {editingReminder.contact.name}
              </h2>
              <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Service:</strong> {editingReminder.service.name}<br />
                  <strong>Service Defaults:</strong> Every {editingReminder.service.recurring_interval_days} days, 
                  reminder {editingReminder.service.recurring_reminder_days_before} days before
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Active (send recurring reminders to this customer)
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Interval (days) - Leave empty to use service default ({editingReminder.service.recurring_interval_days} days)
                </label>
                <input
                  type="number"
                  value={formData.custom_interval_days || ''}
                  onChange={(e) => setFormData({ ...formData, custom_interval_days: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={`${editingReminder.service.recurring_interval_days} (service default)`}
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many days between service reminders for this customer
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Reminder Days Before - Leave empty to use service default ({editingReminder.service.recurring_reminder_days_before} days)
                </label>
                <input
                  type="number"
                  value={formData.custom_reminder_days_before || ''}
                  onChange={(e) => setFormData({ ...formData, custom_reminder_days_before: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={`${editingReminder.service.recurring_reminder_days_before} (service default)`}
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many days before the due date to send the reminder
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Message - Leave empty to use service default
                </label>
                <textarea
                  value={formData.custom_message || ''}
                  onChange={(e) => setFormData({ ...formData, custom_message: e.target.value || null })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={editingReminder.service.recurring_reminder_message || 'Service default message'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Personalized message for this customer's recurring reminders
                </p>
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

      {/* History Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Booking History</h2>
              <button onClick={() => setViewingHistory(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {reminderHistory && reminderHistory.length > 0 ? (
                <div className="space-y-3">
                  {reminderHistory.map((booking: any) => (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(booking.scheduled_time).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          {booking.notes && (
                            <p className="text-sm text-gray-600 mt-1">{booking.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {booking.cost && (
                            <span className="text-sm font-medium text-gray-900">CHF {booking.cost}</span>
                          )}
                          <span className={`px-2 py-1 text-xs rounded font-medium ${
                            booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No booking history available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringRemindersTab;
