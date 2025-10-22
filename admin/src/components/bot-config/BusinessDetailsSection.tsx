import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../lib/api';
import { Save, Building2, MapPin, Phone, Mail, Clock, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';

const BusinessDetailsSection = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    business_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    business_location: '',
    business_directions: '',
    opening_hours: '',
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
        return setting?.value || '';
      };

      setFormData({
        business_name: getSetting('business_name'),
        business_address: getSetting('business_address'),
        business_phone: getSetting('business_phone'),
        business_email: getSetting('business_email'),
        business_location: getSetting('business_location'),
        business_directions: getSetting('business_directions'),
        opening_hours: getSetting('opening_hours'),
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const promises = Object.entries(data).map(([key, value]) =>
        settingsApi.update(key, value)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Business details saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save business details');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Business Details</strong> are used by the bot to personalize conversations, 
          provide accurate location information, and manage booking times within your operating hours.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          Business Information
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Name *
            </label>
            <input
              type="text"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              placeholder="e.g., Zahnarztpraxis Dr. Meier"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used in bot greetings and confirmations
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Phone className="w-4 h-4" />
              Phone Number
            </label>
            <input
              type="text"
              value={formData.business_phone}
              onChange={(e) => setFormData({ ...formData, business_phone: e.target.value })}
              placeholder="+41 79 123 4567"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Mail className="w-4 h-4" />
              Email Address
            </label>
            <input
              type="email"
              value={formData.business_email}
              onChange={(e) => setFormData({ ...formData, business_email: e.target.value })}
              placeholder="info@zahnarztpraxis.ch"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Address
            </label>
            <input
              type="text"
              value={formData.business_address}
              onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
              placeholder="Bahnhofstrasse 15, 8001 Zürich"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-600" />
          Location & Directions
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location Description
            </label>
            <textarea
              value={formData.business_location}
              onChange={(e) => setFormData({ ...formData, business_location: e.target.value })}
              placeholder="e.g., Located in Zürich city center, near Paradeplatz"
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Short description of your location for customers
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Directions (How to Get There)
            </label>
            <textarea
              value={formData.business_directions}
              onChange={(e) => setFormData({ ...formData, business_directions: e.target.value })}
              placeholder="e.g., By tram: Line 6/7 to Paradeplatz, 2 min walk. By car: Parking at Jelmoli"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Detailed directions included in booking confirmations
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Opening Hours
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Hours *
          </label>
          <textarea
            value={formData.opening_hours}
            onChange={(e) => setFormData({ ...formData, opening_hours: e.target.value })}
            placeholder="Monday-Friday: 09:00-18:00&#10;Saturday: 09:00-14:00&#10;Sunday: Closed"
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Generic business hours information shown to customers. For booking restrictions, configure each service individually in the Service Configuration tab.
          </p>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Context Information Only:</strong> These hours are provided to customers as general business information. 
            To control when specific services can be booked, use the Service Configuration tab to set booking windows per service.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !formData.business_name}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {saveMutation.isPending ? 'Saving...' : 'Save Business Details'}
        </button>
      </div>
    </div>
  );
};

export default BusinessDetailsSection;
