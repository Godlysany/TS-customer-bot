import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../lib/api';
import type { Conversation, Message } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Send, AlertCircle, CheckCircle, Play, Hand } from 'lucide-react';

const Conversations = () => {
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [takeoverMode, setTakeoverMode] = useState<'pause_bot' | 'write_between' | 'full_control'>('pause_bot');
  const queryClient = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await conversationsApi.getAll();
      return res.data;
    },
  });

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

  const takeoverMutation = useMutation({
    mutationFn: () => 
      conversationsApi.takeover(selectedConv!, takeoverMode, 'agent-1'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeover', selectedConv] });
    },
  });

  const endTakeoverMutation = useMutation({
    mutationFn: () => 
      conversationsApi.endTakeover(selectedConv!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeover', selectedConv] });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: (reason: string) => 
      conversationsApi.escalate(selectedConv!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => 
      conversationsApi.resolve(selectedConv!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() && selectedConv) {
      sendMessageMutation.mutate(messageInput);
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-1/3 border-r border-gray-200 bg-white">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Conversations</h2>
        </div>
        <div className="overflow-y-auto">
          {conversations?.map((conv: Conversation) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConv(conv.id)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedConv === conv.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">
                    {conv.contact?.name || conv.contact?.phone || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {conv.contact?.phone}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  conv.status === 'active' ? 'bg-green-100 text-green-800' :
                  conv.status === 'escalated' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {conv.status}
                </span>
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
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {conversations?.find((c: Conversation) => c.id === selectedConv)?.contact?.name || 'Chat'}
                  </h3>
                  {takeoverStatus?.isActive && (
                    <p className="text-sm text-blue-600 mt-1">
                      🎯 Takeover Active: {takeoverStatus.mode.replace('_', ' ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!takeoverStatus?.isActive ? (
                    <>
                      <select
                        value={takeoverMode}
                        onChange={(e) => setTakeoverMode(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="pause_bot">Pause Bot</option>
                        <option value="write_between">Write Between</option>
                        <option value="full_control">Full Control</option>
                      </select>
                      <button
                        onClick={() => takeoverMutation.mutate()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Hand className="w-4 h-4" />
                        Take Over
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => endTakeoverMutation.mutate()}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      End Takeover
                    </button>
                  )}
                  <button
                    onClick={() => escalateMutation.mutate('Manual escalation')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Escalate
                  </button>
                  <button
                    onClick={() => resolveMutation.mutate()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Resolve
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages?.map((msg: Message) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-md px-4 py-2 rounded-lg ${
                    msg.direction === 'outbound'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p>{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      msg.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                      {msg.intent && ` · ${msg.intent}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start
          </div>
        )}
      </div>
    </div>
  );
};

export default Conversations;
