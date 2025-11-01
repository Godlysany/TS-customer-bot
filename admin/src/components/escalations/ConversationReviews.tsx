import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { escalationsApi, authApi } from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, User, Clock, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Escalation {
  id: string;
  conversationId: string;
  agentId?: string;
  reason?: string;
  status: 'pending' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
  conversation: {
    id: string;
    lastMessage: string;
    lastMessageAt: string;
    contact: {
      id: string;
      name: string;
      phoneNumber: string;
    };
  };
  agent?: {
    id: string;
    username: string;
    fullName: string;
  };
}

const ConversationReviews = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('pending');
  const [selectedEscalation, setSelectedEscalation] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await authApi.me();
      return res.data.agent;
    },
  });

  const { data: escalations, isLoading } = useQuery({
    queryKey: ['escalations', statusFilter],
    queryFn: async () => {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : {};
      const res = await escalationsApi.getAll(filters);
      return res.data as Escalation[];
    },
    refetchInterval: 5000,
  });

  const { data: counts } = useQuery({
    queryKey: ['escalation-counts'],
    queryFn: async () => {
      const res = await escalationsApi.getCounts();
      return res.data;
    },
    refetchInterval: 10000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ escalationId, agentId }: { escalationId: string; agentId: string }) =>
      escalationsApi.assign(escalationId, agentId),
    onSuccess: () => {
      toast.success('Escalation assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalation-counts'] });
    },
    onError: () => {
      toast.error('Failed to assign escalation');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (escalationId: string) => escalationsApi.resolve(escalationId),
    onSuccess: () => {
      toast.success('Escalation resolved');
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalation-counts'] });
    },
    onError: () => {
      toast.error('Failed to resolve escalation');
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ escalationId, content }: { escalationId: string; content: string }) =>
      escalationsApi.reply(escalationId, content),
    onSuccess: () => {
      toast.success('Reply sent to customer via WhatsApp');
      setReplyMessage('');
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
    onError: () => {
      toast.error('Failed to send reply');
    },
  });

  const handleAssignToMe = (escalationId: string) => {
    if (currentUser?.id) {
      assignMutation.mutate({ escalationId, agentId: currentUser.id });
    }
  };

  const handleResolve = (escalationId: string) => {
    resolveMutation.mutate(escalationId);
  };

  const handleSendReply = () => {
    if (!selectedEscalation || !replyMessage.trim()) {
      return;
    }
    replyMutation.mutate({ escalationId: selectedEscalation, content: replyMessage.trim() });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const selected = escalations?.find(e => e.id === selectedEscalation);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with Stats */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Conversation Reviews</h2>
            <p className="text-sm text-gray-600 mt-1">Manage customer escalations requiring human attention</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-red-700">{counts?.pending || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">In Progress</p>
                <p className="text-2xl font-bold text-yellow-700">{counts?.in_progress || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Resolved</p>
                <p className="text-2xl font-bold text-green-700">{counts?.resolved || 0}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-gray-700">{counts?.total || 0}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'in_progress'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            In Progress
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'resolved'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Resolved
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Escalations List */}
        <div className="w-2/5 bg-white border-r border-gray-200 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading escalations...</div>
          ) : escalations && escalations.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {escalations.map((escalation) => (
                <div
                  key={escalation.id}
                  onClick={() => setSelectedEscalation(escalation.id)}
                  className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                    selectedEscalation === escalation.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{escalation.conversation.contact.name}</p>
                        <p className="text-xs text-gray-500">{escalation.conversation.contact.phoneNumber}</p>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(escalation.status)}`}>
                      {getStatusIcon(escalation.status)}
                      {escalation.status.replace('_', ' ')}
                    </span>
                  </div>

                  {escalation.reason && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{escalation.reason}</p>
                  )}

                  {escalation.conversation.lastMessage && (
                    <p className="text-sm text-gray-500 line-clamp-1 italic">
                      "{escalation.conversation.lastMessage}"
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                    <span>
                      {formatDistanceToNow(new Date(escalation.createdAt), { addSuffix: true })}
                    </span>
                    {escalation.agent && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {escalation.agent.fullName}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No escalations found</p>
              <p className="text-sm text-gray-400 mt-1">
                {statusFilter !== 'all' ? `No ${statusFilter} escalations at the moment` : 'All clear!'}
              </p>
            </div>
          )}
        </div>

        {/* Escalation Detail Panel */}
        <div className="flex-1 bg-gray-50">
          {selected ? (
            <div className="h-full overflow-y-auto p-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      {selected.conversation.contact.name}
                    </h2>
                    <p className="text-gray-600">{selected.conversation.contact.phoneNumber}</p>
                  </div>
                  <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-medium ${getStatusColor(selected.status)}`}>
                    {getStatusIcon(selected.status)}
                    {selected.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {selected.reason && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-900 mb-1">Escalation Reason</p>
                    <p className="text-amber-800">{selected.reason}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Created</p>
                    <p className="font-medium text-gray-900">
                      {formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Last Updated</p>
                    <p className="font-medium text-gray-900">
                      {formatDistanceToNow(new Date(selected.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Assigned Agent</p>
                    <p className="font-medium text-gray-900">
                      {selected.agent ? selected.agent.fullName : 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Last Message</p>
                    <p className="font-medium text-gray-900">
                      {formatDistanceToNow(new Date(selected.conversation.lastMessageAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {selected.conversation.lastMessage && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Latest Message</p>
                    <p className="text-gray-800">{selected.conversation.lastMessage}</p>
                  </div>
                )}

                {/* Quick Reply Section */}
                {selected.status !== 'resolved' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Send Reply via WhatsApp
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={replyMutation.isPending}
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={!replyMessage.trim() || replyMutation.isPending}
                        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {replyMutation.isPending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Message will be sent directly to customer's WhatsApp
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  {selected.status === 'pending' && (
                    <button
                      onClick={() => handleAssignToMe(selected.id)}
                      disabled={assignMutation.isPending}
                      className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Assign to Me
                    </button>
                  )}
                  
                  {selected.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(selected.id)}
                      disabled={resolveMutation.isPending}
                      className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Mark as Resolved
                    </button>
                  )}
                  
                  <Link
                    to={`/conversations?id=${selected.conversationId}`}
                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-5 h-5" />
                    View Conversation
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Select an escalation to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationReviews;
