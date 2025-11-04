import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamUnavailabilityApi } from '../../lib/api';
import { Plus, Trash2, Calendar, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface UnavailabilityPeriod {
  id?: string;
  team_member_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  is_recurring?: boolean;
}

interface TeamUnavailabilityManagerProps {
  teamMemberId: string;
  teamMemberName: string;
}

const TeamUnavailabilityManager = ({ teamMemberId, teamMemberName }: TeamUnavailabilityManagerProps) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<UnavailabilityPeriod | null>(null);
  const [formData, setFormData] = useState<Partial<UnavailabilityPeriod>>({});

  const { data: unavailabilityPeriods, isLoading } = useQuery({
    queryKey: ['team-unavailability', teamMemberId],
    queryFn: async () => {
      const res = await teamUnavailabilityApi.getAll(teamMemberId);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<UnavailabilityPeriod>) => teamUnavailabilityApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-unavailability'] });
      toast.success('Unavailability period added successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add unavailability period');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UnavailabilityPeriod> }) =>
      teamUnavailabilityApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-unavailability'] });
      toast.success('Unavailability period updated successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update unavailability period');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamUnavailabilityApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-unavailability'] });
      toast.success('Unavailability period deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete unavailability period');
    },
  });

  const openModal = (period?: UnavailabilityPeriod) => {
    if (period) {
      setEditingPeriod(period);
      setFormData(period);
    } else {
      setEditingPeriod(null);
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        team_member_id: teamMemberId,
        start_date: today,
        end_date: today,
        reason: '',
        is_recurring: false,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPeriod(null);
    setFormData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.start_date || !formData.end_date) {
      toast.error('Please provide both start and end dates');
      return;
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      toast.error('End date must be after start date');
      return;
    }

    if (editingPeriod) {
      updateMutation.mutate({ id: editingPeriod.id!, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? '1 day' : `${diffDays} days`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Holiday & Time Off Planning</h4>
          <p className="text-xs text-gray-500 mt-1">
            Block out dates when {teamMemberName} is unavailable for bookings
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Period
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : unavailabilityPeriods && unavailabilityPeriods.length > 0 ? (
        <div className="space-y-2">
          {unavailabilityPeriods.map((period: UnavailabilityPeriod) => (
            <div
              key={period.id}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-start gap-3 flex-1">
                <Calendar className="w-4 h-4 text-gray-400 mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {formatDate(period.start_date)} - {formatDate(period.end_date)}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {getDuration(period.start_date, period.end_date)}
                    </span>
                  </div>
                  {period.reason && (
                    <p className="text-xs text-gray-600 mt-1">{period.reason}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm('Delete this unavailability period?')) {
                    deleteMutation.mutate(period.id!);
                  }
                }}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">No unavailability periods set</p>
          <p className="text-xs text-gray-500 mt-1">Click "Add Period" to block out holidays or time off</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                {editingPeriod ? 'Edit Unavailability Period' : 'Add Unavailability Period'}
              </h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-900">
                    The booking system will automatically prevent appointments for {teamMemberName} during this period. Existing bookings will not be affected.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.end_date || ''}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={formData.reason || ''}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Vacation, Conference, Personal leave"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is for internal reference only and won't be shown to customers
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingPeriod
                    ? 'Update'
                    : 'Add Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamUnavailabilityManager;
