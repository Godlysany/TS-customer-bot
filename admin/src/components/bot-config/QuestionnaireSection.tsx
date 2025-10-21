import React from 'react';

const QuestionnaireSection = () => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Questionnaires</strong> - Reusing existing questionnaire management from original bot config.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Questionnaire Builder</h3>
        <p className="text-gray-600">
          The questionnaire builder has been moved to a dedicated page. Access it from the main navigation.
        </p>
      </div>
    </div>
  );
};

export default QuestionnaireSection;
