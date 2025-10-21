import React from 'react';
import { Save } from 'lucide-react';

const ServiceConfigSection = () => {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>🚧 Service Configuration</strong> - Coming Soon. 
          Configure service trigger words, time restrictions, and emergency blocker slots here.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Trigger Words</h3>
        <p className="text-gray-600">
          Configure keywords that trigger specific services (e.g., "cleaning" → Dental Cleaning)
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Time Restrictions</h3>
        <p className="text-gray-600">
          Set time constraints per service (e.g., dental implants only in mornings)
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Blocker Slots</h3>
        <p className="text-gray-600">
          Block specific times for holidays, staff vacations, or emergencies
        </p>
      </div>
    </div>
  );
};

export default ServiceConfigSection;
