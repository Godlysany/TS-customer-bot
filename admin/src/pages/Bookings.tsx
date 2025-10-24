import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, waitlistApi, customersApi } from '../lib/api';
import type { Booking } from '../types';
import { format } from 'date-fns';
import { Calendar, Clock, X, Users, Phone, Mail, User, AlertCircle } from 'lucide-react';

const Bookings = () => {
  const [activeTab, setActiveTab] = useState<'appointments' | 'waitlist'>('appointments');
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const queryClient = useQueryClient();

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

  const cancelBookingMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bookingsApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSelectedBooking(null);
      setCancelReason('');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      bookingsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const scheduledBookings = bookings?.filter((b: Booking) => b.status === 'scheduled') || [];
  const pastBookings = bookings?.filter((b: Booking) => b.status !== 'scheduled') || [];

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Bookings Management</h1>

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
          </nav>
        </div>

        {activeTab === 'appointments' ? (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Appointments</h2>
              <div className="space-y-4">
                {scheduledBookings.map((booking: Booking) => (
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
                            {format(new Date(booking.startTime), 'MMMM d, yyyy')}
                          </h3>
                          {outstandingBalances && outstandingBalances[booking.contactId] > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-medium text-red-700">
                              <AlertCircle className="w-3 h-3" />
                              <span>CHF {outstandingBalances[booking.contactId].toFixed(2)} outstanding</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>
                              {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
                            </span>
                          </div>
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
                      <button
                        onClick={() => setSelectedBooking(booking.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
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
                {pastBookings.map((booking: Booking) => (
                  <div
                    key={booking.id}
                    className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 opacity-75"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-gray-500" />
                      <h3 className="text-lg font-medium text-gray-700">
                        {format(new Date(booking.startTime), 'MMMM d, yyyy')}
                      </h3>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
                        </span>
                      </div>
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
        ) : (
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
        )}

        {selectedBooking && (
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
                    setSelectedBooking(null);
                    setCancelReason('');
                  }}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Keep Appointment
                </button>
                <button
                  onClick={() => handleCancelBooking(selectedBooking)}
                  disabled={!cancelReason.trim()}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Confirm Cancellation
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
