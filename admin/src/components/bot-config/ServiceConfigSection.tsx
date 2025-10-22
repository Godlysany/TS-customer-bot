import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicesApi, settingsApi } from '../../lib/api';
import { Save, Settings, Clock, Ban, Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  cost: number;
}

interface BookingWindow {
  id?: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  isActive: boolean;
}

interface ServiceBlocker {
  id?: string;
  title: string;
  startTime: string; // ISO timestamp
  endTime: string; // ISO timestamp
  reason?: string;
  isRecurring: boolean;
  recurrencePattern?: 'weekly' | 'monthly' | 'yearly';
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ServiceConfigSectionNew = () => {
  const queryClient = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [triggerWords, setTriggerWords] = useState<Record<string, string[]>>({});
  const [newKeyword, setNewKeyword] = useState('');
  
  // Booking windows state
  const [bookingWindows, setBookingWindows] = useState<BookingWindow[]>([]);
  const [newWindow, setNewWindow] = useState<Partial<BookingWindow>>({
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '17:00',
    isActive: true,
  });
  
  // Blockers state
  const [blockers, setBlockers] = useState<ServiceBlocker[]>([]);
  const [newBlocker, setNewBlocker] = useState<Partial<ServiceBlocker>>({
    title: '',
    startTime: '',
    endTime: '',
    reason: '',
    isRecurring: false,
  });

  // Fetch all services from Services page
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await servicesApi.getAll();
      return res.data;
    },
  });

  // Fetch trigger words from settings
  const { data: settings } = useQuery({
    queryKey: ['settings', 'bot_config'],
    queryFn: async () => {
      const res = await settingsApi.getAll('bot_config');
      return res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      const setting = settings.find((s: any) => s.key === 'service_trigger_words');
      if (setting?.value) {
        try {
          const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
          setTriggerWords(parsed || {});
        } catch {
          setTriggerWords({});
        }
      }
    }
  }, [settings]);

  // Fetch booking windows for selected service
  const { data: fetchedWindows } = useQuery({
    queryKey: ['service-booking-windows', selectedServiceId],
    queryFn: async () => {
      if (!selectedServiceId) return [];
      const res = await servicesApi.getBookingWindows(selectedServiceId);
      return res.data;
    },
    enabled: !!selectedServiceId,
  });

  // Fetch blockers for selected service
  const { data: fetchedBlockers } = useQuery({
    queryKey: ['service-blockers', selectedServiceId],
    queryFn: async () => {
      if (!selectedServiceId) return [];
      const res = await servicesApi.getBlockers(selectedServiceId);
      return res.data;
    },
    enabled: !!selectedServiceId,
  });

  useEffect(() => {
    if (fetchedWindows) {
      setBookingWindows(fetchedWindows);
    }
  }, [fetchedWindows]);

  useEffect(() => {
    if (fetchedBlockers) {
      setBlockers(fetchedBlockers);
    }
  }, [fetchedBlockers]);

  // Save trigger words
  const saveTriggerWordsMutation = useMutation({
    mutationFn: async () => {
      await settingsApi.update('service_trigger_words', JSON.stringify(triggerWords));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Trigger words saved');
    },
    onError: () => toast.error('Failed to save trigger words'),
  });

  // Save booking windows
  const saveWindowsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedServiceId) return;
      await servicesApi.replaceBookingWindows(selectedServiceId, bookingWindows);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-booking-windows'] });
      toast.success('Booking windows saved');
    },
    onError: () => toast.error('Failed to save booking windows'),
  });

  // Save blockers
  const saveBlockersMutation = useMutation({
    mutationFn: async (blocker: ServiceBlocker) => {
      if (!selectedServiceId) return;
      await servicesApi.createBlocker(selectedServiceId, blocker);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-blockers'] });
      toast.success('Blocker saved');
    },
    onError: () => toast.error('Failed to save blocker'),
  });

  const deleteBlockerMutation = useMutation({
    mutationFn: async (blockerId: string) => {
      await servicesApi.deleteBlocker(blockerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-blockers'] });
      toast.success('Blocker deleted');
    },
    onError: () => toast.error('Failed to delete blocker'),
  });

  const selectedService = services.find(s => s.id === selectedServiceId);
  const serviceName = selectedService?.name || '';

  const addKeyword = () => {
    if (newKeyword && serviceName) {
      const keywords = triggerWords[serviceName] || [];
      if (!keywords.includes(newKeyword.toLowerCase())) {
        setTriggerWords({
          ...triggerWords,
          [serviceName]: [...keywords, newKeyword.toLowerCase()],
        });
        setNewKeyword('');
      }
    }
  };

  const removeKeyword = (keyword: string) => {
    if (serviceName) {
      setTriggerWords({
        ...triggerWords,
        [serviceName]: (triggerWords[serviceName] || []).filter(k => k !== keyword),
      });
    }
  };

  const addBookingWindow = () => {
    if (newWindow.dayOfWeek !== undefined && newWindow.startTime && newWindow.endTime) {
      setBookingWindows([...bookingWindows, newWindow as BookingWindow]);
      setNewWindow({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        isActive: true,
      });
    }
  };

  const removeBookingWindow = (index: number) => {
    setBookingWindows(bookingWindows.filter((_, i) => i !== index));
  };

  const addBlocker = () => {
    if (newBlocker.title && newBlocker.startTime && newBlocker.endTime) {
      saveBlockersMutation.mutate(newBlocker as ServiceBlocker);
      setNewBlocker({
        title: '',
        startTime: '',
        endTime: '',
        reason: '',
        isRecurring: false,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Service Configuration</strong> - Select a service from the Services page to configure 
          trigger keywords, booking availability windows (like Calendly), and service-specific blocker times.
        </p>
      </div>

      {/* Service Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          Select Service
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => setSelectedServiceId(service.id)}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${
                selectedServiceId === service.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900">{service.name}</div>
              <div className="text-sm text-gray-500 mt-1">{service.description}</div>
              <div className="text-xs text-gray-400 mt-2">
                {service.durationMinutes} min • CHF {service.cost}
              </div>
            </button>
          ))}
        </div>

        {services.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No services found. Create services in the Services page first.</p>
          </div>
        )}
      </div>

      {selectedService && (
        <>
          {/* Trigger Words */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Trigger Words for "{serviceName}"
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Keywords that help the bot recognize when customers are asking about this service.
            </p>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                placeholder="e.g., 'cleaning', 'checkup'"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={addKeyword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(triggerWords[serviceName] || []).map((keyword) => (
                <div
                  key={keyword}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full"
                >
                  {keyword}
                  <button
                    onClick={() => removeKeyword(keyword)}
                    className="hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => saveTriggerWordsMutation.mutate()}
              disabled={saveTriggerWordsMutation.isPending}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Trigger Words
            </button>
          </div>

          {/* Booking Windows */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Booking Availability Windows
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Define when this service can be booked (like Calendly). E.g., "Dental cleanings only on Monday 9-12, Wednesday 8-16".
            </p>

            {/* Add Window Form */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <select
                value={newWindow.dayOfWeek}
                onChange={(e) => setNewWindow({ ...newWindow, dayOfWeek: parseInt(e.target.value) })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                {DAY_NAMES.map((day, i) => (
                  <option key={i} value={i}>{day}</option>
                ))}
              </select>
              <input
                type="time"
                value={newWindow.startTime}
                onChange={(e) => setNewWindow({ ...newWindow, startTime: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="time"
                value={newWindow.endTime}
                onChange={(e) => setNewWindow({ ...newWindow, endTime: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={addBookingWindow}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mx-auto" />
              </button>
            </div>

            {/* Windows List */}
            <div className="space-y-2 mb-4">
              {bookingWindows.map((window, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span>
                    {DAY_NAMES[window.dayOfWeek]}: {window.startTime} - {window.endTime}
                  </span>
                  <button
                    onClick={() => removeBookingWindow(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => saveWindowsMutation.mutate()}
              disabled={saveWindowsMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Booking Windows
            </button>
          </div>

          {/* Service Blockers */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              Service-Specific Blocker Times
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Block specific times when this service CANNOT be booked (holidays, maintenance, etc.).
            </p>

            {/* Add Blocker Form */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input
                type="text"
                value={newBlocker.title}
                onChange={(e) => setNewBlocker({ ...newBlocker, title: e.target.value })}
                placeholder="Title (e.g., Holiday Break)"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                value={newBlocker.reason}
                onChange={(e) => setNewBlocker({ ...newBlocker, reason: e.target.value })}
                placeholder="Reason (optional)"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="datetime-local"
                value={newBlocker.startTime}
                onChange={(e) => setNewBlocker({ ...newBlocker, startTime: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="datetime-local"
                value={newBlocker.endTime}
                onChange={(e) => setNewBlocker({ ...newBlocker, endTime: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <label className="flex items-center gap-2 col-span-2">
                <input
                  type="checkbox"
                  checked={newBlocker.isRecurring}
                  onChange={(e) => setNewBlocker({ ...newBlocker, isRecurring: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Recurring (weekly)</span>
              </label>
              <button
                onClick={addBlocker}
                disabled={saveBlockersMutation.isPending}
                className="col-span-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 justify-center"
              >
                <Plus className="w-4 h-4" />
                Add Blocker
              </button>
            </div>

            {/* Blockers List */}
            <div className="space-y-2">
              {blockers.map((blocker) => (
                <div
                  key={blocker.id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                >
                  <div>
                    <div className="font-semibold text-gray-900">{blocker.title}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(blocker.startTime).toLocaleString()} - {new Date(blocker.endTime).toLocaleString()}
                    </div>
                    {blocker.reason && <div className="text-xs text-gray-500 mt-1">{blocker.reason}</div>}
                    {blocker.isRecurring && <div className="text-xs text-blue-600 mt-1">🔁 Recurring</div>}
                  </div>
                  <button
                    onClick={() => blocker.id && deleteBlockerMutation.mutate(blocker.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ServiceConfigSectionNew;
