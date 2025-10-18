import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botDiscountApi } from '../lib/bot-discount-api';
import { CheckCircle, XCircle, Clock, TrendingUp, DollarSign, Users, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const BotDiscounts = () => {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  const { data: pendingRequests, isLoading } = useQuery({
    queryKey: ['bot-discounts-pending'],
    queryFn: async () => {
      const res = await botDiscountApi.getPending();
      return res.data;
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ['bot-discount-analytics'],
    queryFn: async () => {
      const res = await botDiscountApi.getAnalytics();
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => 
      botDiscountApi.approve(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-discounts-pending'] });
      queryClient.invalidateQueries({ queryKey: ['bot-discount-analytics'] });
      toast.success('Discount request approved');
      setShowApprovalModal(false);
      setSelectedRequest(null);
      setApprovalNotes('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to approve request');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => 
      botDiscountApi.reject(id, notes || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-discounts-pending'] });
      queryClient.invalidateQueries({ queryKey: ['bot-discount-analytics'] });
      toast.success('Discount request rejected');
      setShowApprovalModal(false);
      setSelectedRequest(null);
      setApprovalNotes('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reject request');
    },
  });

  const handleApprove = (request: any) => {
    setSelectedRequest(request);
    setShowApprovalModal(true);
  };

  const confirmApproval = () => {
    if (selectedRequest) {
      approveMutation.mutate({ id: selectedRequest.id, notes: approvalNotes });
    }
  };

  const confirmReject = () => {
    if (selectedRequest) {
      rejectMutation.mutate({ id: selectedRequest.id, notes: approvalNotes });
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.3) return 'text-green-600 bg-green-50';
    if (score < -0.3) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bot Discount Approvals</h1>
          <p className="text-gray-600 mt-2">
            Review and approve bot-suggested discount requests
          </p>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Pending Requests</h3>
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.pending || 0}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Approval Rate</h3>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {analytics.approval_rate ? `${(analytics.approval_rate * 100).toFixed(0)}%` : 'N/A'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Avg Discount</h3>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {analytics.avg_discount_chf ? `${analytics.avg_discount_chf.toFixed(0)} CHF` : 'N/A'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Requests</h3>
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.total_requests || 0}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : pendingRequests?.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-600">No pending discount requests to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests?.map((request: any) => (
            <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-lg">
                        {request.customer_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{request.customer_name || 'Unknown'}</h3>
                      <p className="text-sm text-gray-500">{request.customer_phone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Suggested Discount</p>
                      <p className="text-lg font-bold text-blue-600">{request.suggested_discount_amount} CHF</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Sentiment</p>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getSentimentColor(request.sentiment_score)}`}>
                        {request.sentiment_score?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Lifetime Value</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {request.customer_lifetime_value?.toFixed(0) || 0} CHF
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Inactive Days</p>
                      <p className="text-lg font-semibold text-gray-900">{request.days_since_last_interaction || 0}</p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800 mb-1">Bot Reasoning:</p>
                        <p className="text-sm text-yellow-700">{request.reasoning || 'No reasoning provided'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Requested: {new Date(request.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleApprove(request)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRequest(request);
                      confirmReject();
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Approve Discount Request</h2>
            
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Customer:</strong> {selectedRequest.customer_name}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Discount:</strong> {selectedRequest.suggested_discount_amount} CHF
              </p>
              <p className="text-sm text-gray-700">
                <strong>Lifetime Value:</strong> {selectedRequest.customer_lifetime_value?.toFixed(0) || 0} CHF
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approval Notes (optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Add any notes about this approval..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmApproval}
                disabled={approveMutation.isPending}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Approving...' : 'Confirm Approval'}
              </button>
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedRequest(null);
                  setApprovalNotes('');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotDiscounts;
