import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi, messageApprovalApi, authApi } from '../lib/api';
import type { Conversation, Message } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Send, CheckCircle, User, FileText, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Conversations = () => {
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const queryClient = useQueryClient();

  // Get current user for agent ID
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await authApi.me();
      return res.data;
    },
  });

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await conversationsApi.getAll();
      return res.data;
    },
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const res = await messageApprovalApi.getPending();
      return res.data || [];
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Count pending approvals per conversation
  const getPendingCountForConversation = (convId: string) => {
    if (!pendingApprovals) return 0;
    return pendingApprovals.filter((msg: any) => msg.conversationId === convId).length;
  };

  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConv],
    queryFn: async () => {
      if (!selectedConv) return [];
      const res = await conversationsApi.getMessages(selectedConv);
      return res.data;
    },
    enabled: !!selectedConv,
  });

  const { data: takeoverStatus } = useQuery({
    queryKey: ['takeover', selectedConv],
    queryFn: async () => {
      if (!selectedConv) return null;
      const res = await conversationsApi.getTakeoverStatus(selectedConv);
      return res.data;
    },
    enabled: !!selectedConv,
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => 
      conversationsApi.sendMessage(selectedConv!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConv] });
      setMessageInput('');
    },
  });

  const toggleBotMutation = useMutation({
    mutationFn: async () => {
      if (takeoverStatus?.isActive) {
        return conversationsApi.endTakeover(selectedConv!);
      } else {
        const agentId = currentUser?.id || 'system';
        return conversationsApi.takeover(selectedConv!, 'pause_bot', agentId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeover', selectedConv] });
      if (takeoverStatus?.isActive) {
        toast.success('Bot resumed - AI will respond to customer');
      } else {
        toast.success('Bot paused - You have full control');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to toggle bot');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => 
      conversationsApi.resolve(selectedConv!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['takeover', selectedConv] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (messageId: string) => messageApprovalApi.approve(messageId),
    onSuccess: () => {
      toast.success('Message approved and sent');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConv] });
    },
    onError: () => {
      toast.error('Failed to approve message');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (messageId: string) => messageApprovalApi.reject(messageId),
    onSuccess: () => {
      toast.success('Message rejected');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConv] });
    },
    onError: () => {
      toast.error('Failed to reject message');
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() && selectedConv) {
      // Auto-pause bot when agent sends a message
      if (!takeoverStatus?.isActive) {
        toggleBotMutation.mutate();
      }
      sendMessageMutation.mutate(messageInput);
    }
  };

  const currentConversation = conversations?.find((c: Conversation) => c.id === selectedConv);
  const isEscalated = currentConversation?.status === 'escalated';

  return (
    <div className="flex h-full bg-gray-50">
      <div className="w-1/3 border-r border-gray-200 bg-white">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">Conversations</h2>
        </div>
        <div className="overflow-y-auto">
          {conversations?.map((conv: Conversation) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConv(conv.id)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-all hover:bg-slate-50 ${
                selectedConv === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {conv.contact?.name || conv.contact?.phone || 'Unknown'}
                    </p>
                    {getPendingCountForConversation(conv.id) > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full animate-pulse">
                        {getPendingCountForConversation(conv.id)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {conv.contact?.phone}
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {conv.status === 'escalated' && (
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Escalated
                    </span>
                  )}
                  {getPendingCountForConversation(conv.id) > 0 && (
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
                      Needs Approval
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {conv.lastMessageAt && formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white">
        {selectedConv ? (
          <>
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {currentConversation?.contact?.name || currentConversation?.contact?.phone || 'Chat'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Link
                        to={`/customers/${currentConversation?.contactId}`}
                        className="text-gray-600 hover:text-blue-600 transition-colors"
                        title="View Customer Profile"
                      >
                        <User className="w-4 h-4" />
                      </Link>
                      <Link
                        to="/questionnaires"
                        className="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Questionnaires
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${takeoverStatus?.isActive ? 'text-gray-700' : 'text-gray-500'}`}>
                      {takeoverStatus?.isActive ? 'Bot Paused' : 'Bot Running'}
                    </span>
                    <button
                      onClick={() => toggleBotMutation.mutate()}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        takeoverStatus?.isActive ? 'bg-gray-400' : 'bg-blue-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          takeoverStatus?.isActive ? 'translate-x-1' : 'translate-x-6'
                        }`}
                      />
                    </button>
                  </div>
                  {isEscalated && (
                    <button
                      onClick={() => resolveMutation.mutate()}
                      className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages?.map((msg: Message) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex flex-col items-end gap-2">
                    <div className={`max-w-md px-4 py-2.5 rounded-2xl shadow-sm ${
                      msg.direction === 'outbound'
                        ? msg.approvalStatus === 'pending_approval'
                          ? 'bg-yellow-100 text-gray-900 border-2 border-yellow-400'
                          : 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900 border border-gray-200'
                    }`}>
                      {msg.direction === 'outbound' && msg.approvalStatus === 'pending_approval' && (
                        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-yellow-700">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                          Pending Approval
                        </div>
                      )}
                      <p className="text-[15px] leading-relaxed">{msg.content}</p>
                      <p className={`text-xs mt-1.5 ${
                        msg.direction === 'outbound' 
                          ? msg.approvalStatus === 'pending_approval'
                            ? 'text-gray-600'
                            : 'text-blue-100'
                          : 'text-gray-500'
                      }`}>
                        {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                        {msg.intent && ` · ${msg.intent}`}
                      </p>
                    </div>
                    {msg.direction === 'outbound' && msg.approvalStatus === 'pending_approval' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveMutation.mutate(msg.id)}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(msg.id)}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="p-5 border-t border-gray-100 bg-white">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-3 text-gray-300" />
              <p className="text-lg">Select a conversation to start</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Conversations;
