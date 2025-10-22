import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../lib/api';
import { Save, Settings, Clock, Ban, Plus, Trash2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface ServiceTriggerWords {
  [serviceName: string]: string[];
}

interface ServiceTimeRestriction {
  min_slot_hours?: number;
  max_slot_hours?: number;
  only_mornings?: boolean;
  only_afternoons?: boolean;
  only_weekdays?: boolean;
  excluded_days?: string[];
}

interface ServiceTimeRestrictions {
  [serviceName: string]: ServiceTimeRestriction;
}

interface BlockerSlot {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

const ServiceConfigSection = () => {
  const queryClient = useQueryClient();
  const [triggerWords, setTriggerWords] = useState<ServiceTriggerWords>({});
  const [timeRestrictions, setTimeRestrictions] = useState<ServiceTimeRestrictions>({});
  const [blockerSlots, setBlockerSlots] = useState<BlockerSlot[]>([]);
  
  const [newService, setNewService] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [selectedService, setSelectedService] = useState('');
  
  const [newBlocker, setNewBlocker] = useState({
    start_date: '',
    end_date: '',
    reason: '',
  });

  const { data: settings } = useQuery({
    queryKey: ['settings', 'bot_config'],
    queryFn: async () => {
      const res = await settingsApi.getAll('bot_config');
      return res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      const getSetting = (key: string) => {
        const setting = settings.find((s: any) => s.key === key);
        if (!setting?.value) return null;
        try {
          return typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
        } catch {
          return null;
        }
      };

      setTriggerWords(getSetting('service_trigger_words') || {});
      setTimeRestrictions(getSetting('service_time_restrictions') || {});
      setBlockerSlots(getSetting('emergency_blocker_slots') || []);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        settingsApi.update('service_trigger_words', JSON.stringify(triggerWords)),
        settingsApi.update('service_time_restrictions', JSON.stringify(timeRestrictions)),
        settingsApi.update('emergency_blocker_slots', JSON.stringify(blockerSlots)),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Service configuration saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save service configuration');
    },
  });

  const addService = () => {
    if (newService && !triggerWords[newService]) {
      setTriggerWords({ ...triggerWords, [newService]: [] });
      setTimeRestrictions({ ...timeRestrictions, [newService]: {} });
      setNewService('');
      setSelectedService(newService);
    }
  };

  const removeService = (serviceName: string) => {
    const { [serviceName]: _, ...restTriggers } = triggerWords;
    const { [serviceName]: __, ...restRestrictions } = timeRestrictions;
    setTriggerWords(restTriggers);
    setTimeRestrictions(restRestrictions);
    if (selectedService === serviceName) setSelectedService('');
  };

  const addKeyword = (serviceName: string) => {
    if (newKeyword && triggerWords[serviceName]) {
      const keywords = triggerWords[serviceName];
      if (!keywords.includes(newKeyword.toLowerCase())) {
        setTriggerWords({
          ...triggerWords,
          [serviceName]: [...keywords, newKeyword.toLowerCase()],
        });
        setNewKeyword('');
      }
    }
  };

  const removeKeyword = (serviceName: string, keyword: string) => {
    setTriggerWords({
      ...triggerWords,
      [serviceName]: triggerWords[serviceName].filter((k) => k !== keyword),
    });
  };

  const updateRestriction = (serviceName: string, field: string, value: any) => {
    setTimeRestrictions({
      ...timeRestrictions,
      [serviceName]: {
        ...timeRestrictions[serviceName],
        [field]: value,
      },
    });
  };

  const addBlockerSlot = () => {
    if (newBlocker.start_date && newBlocker.end_date && newBlocker.reason) {
      setBlockerSlots([
        ...blockerSlots,
        {
          id: Date.now().toString(),
          ...newBlocker,
        },
      ]);
      setNewBlocker({ start_date: '', end_date: '', reason: '' });
    }
  };

  const removeBlockerSlot = (id: string) => {
    setBlockerSlots(blockerSlots.filter((slot) => slot.id !== id));
  };

  const services = Object.keys(triggerWords);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Service Configuration</strong> defines how the bot recognizes service requests through 
          trigger keywords and applies time constraints for specific services.
        </p>
      </div>

      {/* Service Trigger Words */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          Service Trigger Words
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Define keywords that trigger specific services. When a customer mentions these words, 
          the bot will understand which service they're interested in.
        </p>

        {/* Add New Service */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex gap-2">
            <input
              type="text"
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addService()}
              placeholder="e.g., Dental Cleaning, Root Canal, Teeth Whitening"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addService}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </button>
          </div>
        </div>

        {/* Service List */}
        <div className="space-y-4">
          {services.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No services configured yet. Add your first service above.
            </div>
          ) : (
            services.map((serviceName) => (
              <div key={serviceName} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{serviceName}</h4>
                  <button
                    onClick={() => removeService(serviceName)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Keywords */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trigger Keywords
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {triggerWords[serviceName].map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {keyword}
                        <button
                          onClick={() => removeKeyword(serviceName, keyword)}
                          className="hover:text-blue-900"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedService === serviceName ? newKeyword : ''}
                      onChange={(e) => {
                        setSelectedService(serviceName);
                        setNewKeyword(e.target.value);
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && addKeyword(serviceName)}
                      placeholder="e.g., cleaning, checkup, hygiene"
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => addKeyword(serviceName)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Service Time Restrictions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          Service Time Restrictions
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Configure time constraints for specific services (e.g., certain procedures only in mornings).
        </p>

        {services.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Add services first to configure time restrictions.
          </div>
        ) : (
          <div className="space-y-4">
            {services.map((serviceName) => {
              const restrictions = timeRestrictions[serviceName] || {};
              return (
                <div key={serviceName} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">{serviceName}</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Slot Duration (hours)
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={restrictions.min_slot_hours || ''}
                        onChange={(e) =>
                          updateRestriction(serviceName, 'min_slot_hours', parseFloat(e.target.value) || undefined)
                        }
                        placeholder="e.g., 1.5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Slot Duration (hours)
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={restrictions.max_slot_hours || ''}
                        onChange={(e) =>
                          updateRestriction(serviceName, 'max_slot_hours', parseFloat(e.target.value) || undefined)
                        }
                        placeholder="e.g., 3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={restrictions.only_mornings || false}
                        onChange={(e) => updateRestriction(serviceName, 'only_mornings', e.target.checked || undefined)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Only available in mornings (before 12:00)</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={restrictions.only_afternoons || false}
                        onChange={(e) => updateRestriction(serviceName, 'only_afternoons', e.target.checked || undefined)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Only available in afternoons (after 12:00)</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={restrictions.only_weekdays || false}
                        onChange={(e) => updateRestriction(serviceName, 'only_weekdays', e.target.checked || undefined)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Only available on weekdays (Mon-Fri)</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Emergency Blocker Slots */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Ban className="w-5 h-5 text-red-600" />
          Emergency Blocker Slots
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Block specific date ranges for holidays, staff vacations, or emergency closures.
        </p>

        {/* Add New Blocker */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={newBlocker.start_date}
                onChange={(e) => setNewBlocker({ ...newBlocker, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={newBlocker.end_date}
                onChange={(e) => setNewBlocker({ ...newBlocker, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input
                type="text"
                value={newBlocker.reason}
                onChange={(e) => setNewBlocker({ ...newBlocker, reason: e.target.value })}
                placeholder="e.g., Christmas Holiday"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={addBlockerSlot}
            disabled={!newBlocker.start_date || !newBlocker.end_date || !newBlocker.reason}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Calendar className="w-4 h-4" />
            Add Blocked Period
          </button>
        </div>

        {/* Blocker List */}
        <div className="space-y-2">
          {blockerSlots.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              No blocked periods configured.
            </div>
          ) : (
            blockerSlots.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{slot.reason}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(slot.start_date).toLocaleDateString()} - {new Date(slot.end_date).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => removeBlockerSlot(slot.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saveMutation.isPending ? 'Saving...' : 'Save Service Configuration'}
        </button>
      </div>
    </div>
  );
};

export default ServiceConfigSection;
