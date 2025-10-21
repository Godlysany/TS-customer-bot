import React from 'react';

const AdvancedControlsSection = () => {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>⚠️ Advanced Controls</strong> - Feature toggles and safeguards for brand protection.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Toggles</h3>
        <p className="text-gray-600">
          Control which bot features are enabled (auto-response, booking, questionnaires, etc.)
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Safety Safeguards</h3>
        <p className="text-gray-600">
          Configure confidence thresholds, fallback messages, and approval workflows
        </p>
      </div>
    </div>
  );
};

export default AdvancedControlsSection;
