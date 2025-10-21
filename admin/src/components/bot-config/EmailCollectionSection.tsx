import React from 'react';

const EmailCollectionSection = () => {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>🚧 Email Collection</strong> - Coming Soon. 
          Configure how the bot collects customer email addresses (mandatory vs gentle).
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Collection Mode</h3>
        <p className="text-gray-600">
          Choose how aggressively to collect email addresses from customers
        </p>
      </div>
    </div>
  );
};

export default EmailCollectionSection;
