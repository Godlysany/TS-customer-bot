import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, waitlistApi, customersApi, servicesApi, teamMembersApi } from '../lib/api';
import { contactApi } from '../lib/contact-api';
import type { Booking } from '../types';
import { format } from 'date-fns';
import { Calendar, Clock, X, Users, Phone, Mail, User, AlertCircle, Edit, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import MultisessionBookingsTab from '../components/bookings/MultisessionBookingsTab';

const Bookings = () => {
  const [activeTab, setActiveTab] = useState<'appointments' | 'waitlist' | 'multisession'>('appointments');
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<string | null>(null);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<any | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const queryClient = useQueryClient();

  // Edit form state
  const [editFormData, setEditFormData] = useState<any>({});
  const [createFormData, setCreateFormData] = useState<any>({
    contactId: '',
    serviceId: '',
    teamMemberId: '',
    date: '',
    startTime: '',
    duration: 60,
    notes: '',
  });

  const { data: bookings } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const res = await bookingsApi.getAll();
      return res.data;
    },
  });

  const { data: outstandingBalances } = useQuery({
    queryKey: ['outstanding-balances-map'],
    queryFn: async () => {
      const res = await customersApi.getOutstandingBalances();
      const customersMap: any = {};
      res.data.customers.forEach((c: any) => {
        customersMap[c.id] = c.outstanding_balance_chf;
      });
      return customersMap;
    },
  });

  const { data: waitlistEntries } = useQuery({
    queryKey: ['waitlist'],
    queryFn: async () => {
      const res = await waitlistApi.getAll();
      return res.data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await servicesApi.getAll();
      return res.data;
    },
  });

  const { data: allContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const res = await contactApi.getAll();
      return res.data;
    },
  });

  const { data: allTeamMembers } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await teamMembersApi.getAll();
      return res.data;
    },
  });

  // Get team members for selected service
  const getTeamMembersForService = (serviceId: string) => {
    if (!serviceId || !allTeamMembers) return [];
    
    const service = services?.find((s: any) => s.id === serviceId);
    if (!service?.teamMemberIds || service.teamMemberIds.length === 0) {
      return allTeamMembers;
    }
    
    return allTeamMembers.filter((tm: any) => 
      service.teamMemberIds.includes(tm.id)
    );
  };

  // Update team members when service changes in edit modal
  useEffect(() => {
    if (editFormData.serviceId) {
      const availableTeamMembers = getTeamMembersForService(editFormData.serviceId);
      if (editFormData.teamMemberId && !availableTeamMembers.some((tm: any) => tm.id === editFormData.teamMemberId)) {
        setEditFormData({ ...editFormData, teamMemberId: '' });
      }
    }
  }, [editFormData.serviceId]);

  // Update team members when service changes in create modal
  useEffect(() => {
    if (createFormData.serviceId) {
      const service = services?.find((s: any) => s.id === createFormData.serviceId);
      if (service) {
        setCreateFormData({ ...createFormData, duration: service.durationMinutes || 60 });
      }
      
      const availableTeamMembers = getTeamMembersForService(createFormData.serviceId);
      if (createFormData.teamMemberId && !availableTeamMembers.some((tm: any) => tm.id === createFormData.teamMemberId)) {
        setCreateFormData({ ...createFormData, teamMemberId: '' });
      }
    }
  }, [createFormData.serviceId]);

  const cancelBookingMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bookingsApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSelectedBookingForCancel(null);
      setCancelReason('');
      toast.success('Booking cancelled successfully');
    },
    onError: () => {
      toast.error('Failed to cancel booking');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      bookingsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      bookingsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSelectedBookingForEdit(null);
      toast.success('Booking updated successfully');
    },
    onError: () => {
      toast.error('Failed to update booking');
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: (data: any) => bookingsApi.createManual(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setIsCreateModalOpen(false);
      setCreateFormData({
        contactId: '',
        serviceId: '',
        teamMemberId: '',
        date: '',
        startTime: '',
        duration: 60,
        notes: '',
      });
      toast.success('Booking created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create booking');
    },
  });

  const cancelWaitlistMutation = useMutation({
    mutationFn: (id: string) => waitlistApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });

  const handleCancelBooking = (id: string) => {
    if (cancelReason.trim()) {
      cancelBookingMutation.mutate({ id, reason: cancelReason });
    }
  };

  const handleEditBooking = (booking: any) => {
    setSelectedBookingForEdit(booking);
    setEditFormData({
      serviceId: booking.serviceId || '',
      teamMemberId: booking.teamMemberId || '',
      date: format(new Date(booking.startTime), 'yyyy-MM-dd'),
      startTime: format(new Date(booking.startTime), 'HH:mm'),
      endTime: format(new Date(booking.endTime), 'HH:mm'),
      status: booking.status,
      notes: booking.notes || '',
    });
  };

  const handleSaveEdit = () => {
    if (!selectedBookingForEdit) return;

    const startDateTime = new Date(`${editFormData.date}T${editFormData.startTime}`);
    const endDateTime = new Date(`${editFormData.date}T${editFormData.endTime}`);

    const updates = {
      serviceId: editFormData.serviceId,
      teamMemberId: editFormData.teamMemberId || null,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      status: editFormData.status,
      notes: editFormData.notes,
    };

    updateBookingMutation.mutate({ id: selectedBookingForEdit.id, updates });
  };

  const handleCreateBooking = () => {
    const startDateTime = new Date(`${createFormData.date}T${createFormData.startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + createFormData.duration * 60000);

    const data = {
      contactId: createFormData.contactId,
      serviceId: createFormData.serviceId,
      teamMemberId: createFormData.teamMemberId || null,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      notes: createFormData.notes,
    };

    createBookingMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'no_show':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const scheduledBookings = bookings?.filter((b: Booking) => b.status === 'scheduled' || b.status === 'confirmed' || b.status === 'pending') || [];
  const pastBookings = bookings?.filter((b: Booking) => !['scheduled', 'confirmed', 'pending'].includes(b.status)) || [];

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Bookings Management</h1>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Create Booking
          </button>
        </div>

        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab('appointments')}
              className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
                activeTab === 'appointments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>Appointments ({scheduledBookings.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('waitlist')}
              className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
                activeTab === 'waitlist'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>Waitlist ({waitlistEntries?.length || 0})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('multisession')}
              className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
                activeTab === 'multisession'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>Multi-Session</span>
              </div>
            </button>
          </nav>
        </div>

        {activeTab === 'appointments' ? (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Appointments</h2>
              <div className="space-y-4">
                {scheduledBookings.map((booking: any) => (
                  <div
                    key={booking.id}
                    className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
                  >
                    {/* Multi-session indicator */}
                    {booking.isPartOfMultiSession && (
                      <div className="mb-4 bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-purple-900">
                            Multi-Session Treatment: Session {booking.sessionNumber} of {booking.totalSessions}
                          </p>
                          <span className="text-xs text-purple-700">
                            {Math.round((booking.sessionNumber! / booking.totalSessions!) * 100)}% Complete
                          </span>
                        </div>
                        <div className="w-full bg-purple-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${(booking.sessionNumber! / booking.totalSessions!) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {booking.contact?.name || 'Unknown Customer'}
                          </h3>
                          {outstandingBalances && outstandingBalances[booking.contactId] > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-medium text-red-700">
                              <AlertCircle className="w-3 h-3" />
                              <span>CHF {outstandingBalances[booking.contactId].toFixed(2)} outstanding</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>
                              {format(new Date(booking.startTime), 'MMM d, yyyy')} • {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
                            </span>
                          </div>
                          
                          {booking.services && (
                            <div className="flex items-center gap-2 text-sm">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: booking.services.color || '#3B82F6' }}
                              />
                              <span className="text-gray-700 font-medium">{booking.services.name}</span>
                            </div>
                          )}
                          
                          {booking.teamMembers && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-gray-400" />
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: booking.teamMembers.color || '#6366F1' }}
                              />
                              <span className="text-gray-600">{booking.teamMembers.name}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <select
                            value={booking.status}
                            onChange={(e) => updateStatusMutation.mutate({ id: booking.id, status: e.target.value })}
                            className={`px-3 py-1 rounded-full text-sm font-medium border-2 ${getStatusColor(booking.status)} cursor-pointer`}
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="no_show">No Show</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditBooking(booking)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => setSelectedBookingForCancel(booking.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {scheduledBookings.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No upcoming appointments
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Past Appointments</h2>
              <div className="space-y-4">
                {pastBookings.map((booking: any) => (
                  <div
                    key={booking.id}
                    className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 opacity-75"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-gray-500" />
                      <h3 className="text-lg font-medium text-gray-700">
                        {booking.contact?.name || 'Unknown Customer'}
                      </h3>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          {format(new Date(booking.startTime), 'MMM d, yyyy')} • {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
                        </span>
                      </div>
                      {booking.services && (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: booking.services.color || '#3B82F6' }}
                          />
                          <span>{booking.services.name}</span>
                        </div>
                      )}
                      <span className={`px-3 py-1 rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))}

                {pastBookings.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No past appointments
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'waitlist' ? (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Waitlist</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Requested
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {waitlistEntries?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No customers on waitlist</p>
                      </td>
                    </tr>
                  ) : (
                    waitlistEntries?.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{entry.contact_name || 'Unknown'}</p>
                              <p className="text-xs text-gray-500">ID: {entry.contact_id?.substring(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">
                            {entry.contact_phone && (
                              <div className="flex items-center gap-2 mb-1">
                                <Phone className="w-4 h-4" />
                                <span>{entry.contact_phone}</span>
                              </div>
                            )}
                            {entry.contact_email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                <span>{entry.contact_email}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(entry.created_at).toLocaleDateString()} at{' '}
                          {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            entry.priority === 'high' ? 'bg-red-100 text-red-700' :
                            entry.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {entry.priority || 'normal'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => cancelWaitlistMutation.mutate(entry.id)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                          >
                            <X className="w-4 h-4" />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {waitlistEntries && waitlistEntries.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Total waitlist entries: {waitlistEntries.length}
              </div>
            )}
          </div>
        ) : (
          <MultisessionBookingsTab />
        )}

        {/* Cancel Booking Modal */}
        {selectedBookingForCancel && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Cancel Appointment</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cancellation Reason
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Please provide a reason for cancellation..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setSelectedBookingForCancel(null);
                    setCancelReason('');
                  }}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Keep Appointment
                </button>
                <button
                  onClick={() => handleCancelBooking(selectedBookingForCancel)}
                  disabled={!cancelReason.trim()}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Booking Modal */}
        {selectedBookingForEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 my-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Booking</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer
                  </label>
                  <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-700">
                    {selectedBookingForEdit.contact?.name || 'Unknown Customer'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service
                  </label>
                  <select
                    value={editFormData.serviceId}
                    onChange={(e) => setEditFormData({ ...editFormData, serviceId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Service</option>
                    {services?.map((service: any) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Member
                  </label>
                  <select
                    value={editFormData.teamMemberId}
                    onChange={(e) => setEditFormData({ ...editFormData, teamMemberId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No team member assigned</option>
                    {getTeamMembersForService(editFormData.serviceId)?.map((tm: any) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_show">No Show</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={editFormData.startTime}
                      onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={editFormData.endTime}
                      onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setSelectedBookingForEdit(null)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Booking Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 my-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Booking</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer *
                  </label>
                  <select
                    value={createFormData.contactId}
                    onChange={(e) => setCreateFormData({ ...createFormData, contactId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Customer</option>
                    {allContacts?.map((contact: any) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name || contact.phoneNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service *
                  </label>
                  <select
                    value={createFormData.serviceId}
                    onChange={(e) => setCreateFormData({ ...createFormData, serviceId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Service</option>
                    {services?.filter((s: any) => s.isActive).map((service: any) => (
                      <option key={service.id} value={service.id}>
                        {service.name} ({service.durationMinutes} min)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Member
                  </label>
                  <select
                    value={createFormData.teamMemberId}
                    onChange={(e) => setCreateFormData({ ...createFormData, teamMemberId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={!createFormData.serviceId}
                  >
                    <option value="">No team member assigned</option>
                    {getTeamMembersForService(createFormData.serviceId)?.map((tm: any) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={createFormData.date}
                      onChange={(e) => setCreateFormData({ ...createFormData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      value={createFormData.startTime}
                      onChange={(e) => setCreateFormData({ ...createFormData, startTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={createFormData.duration}
                    onChange={(e) => setCreateFormData({ ...createFormData, duration: parseInt(e.target.value) || 60 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="15"
                    step="15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={createFormData.notes}
                    onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBooking}
                  disabled={!createFormData.contactId || !createFormData.serviceId || !createFormData.date || !createFormData.startTime}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Create Booking
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bookings;
