import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { questionnaireResponsesApi } from '../lib/api';
import { FileText, Search, Calendar, User, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

const QuestionnaireResponses = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedResponse, setSelectedResponse] = useState<any>(null);

  const { data: responses, isLoading } = useQuery({
    queryKey: ['questionnaire-responses'],
    queryFn: async () => {
      const res = await questionnaireResponsesApi.getAll();
      return res.data;
    },
  });

  const filteredResponses = responses?.filter((response: any) => {
    const matchesSearch = searchTerm === '' || 
      response.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.contact_phone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || response.questionnaire_type === filterType;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Questionnaire Responses</h1>
        <p className="text-gray-600 mt-2">
          View and analyze all questionnaire responses from customers
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name or phone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="anamnesis">Anamnesis</option>
            <option value="feedback">Feedback</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredResponses?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No questionnaire responses found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredResponses?.map((response: any) => (
                      <tr 
                        key={response.id} 
                        className={`hover:bg-gray-50 cursor-pointer ${selectedResponse?.id === response.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedResponse(response)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <User className="w-8 h-8 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{response.contact_name || 'Unknown'}</p>
                              <p className="text-xs text-gray-500">{response.contact_phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            response.questionnaire_type === 'anamnesis' ? 'bg-blue-100 text-blue-700' :
                            response.questionnaire_type === 'feedback' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {response.questionnaire_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <Calendar className="w-4 h-4 mr-2" />
                            {new Date(response.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedResponse(response)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {selectedResponse ? (
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedResponse.questionnaire_name}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Submitted on {new Date(selectedResponse.created_at).toLocaleDateString()} at{' '}
                      {new Date(selectedResponse.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    selectedResponse.questionnaire_type === 'anamnesis' ? 'bg-blue-100 text-blue-700' :
                    selectedResponse.questionnaire_type === 'feedback' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedResponse.questionnaire_type}
                  </span>
                </div>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-lg">
                        {selectedResponse.contact_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedResponse.contact_name || 'Unknown Customer'}</p>
                      <p className="text-sm text-gray-600">{selectedResponse.contact_phone}</p>
                      {selectedResponse.contact_email && (
                        <p className="text-sm text-gray-600">{selectedResponse.contact_email}</p>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/customers/${selectedResponse.contact_id}`}
                    className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700"
                  >
                    View Customer Profile →
                  </Link>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Responses</h3>
                  {selectedResponse.answers && Object.entries(selectedResponse.answers).map(([question, answer]: any, idx: number) => (
                    <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                      <p className="text-sm font-medium text-gray-700 mb-1">Q: {question}</p>
                      <p className="text-gray-900">A: {answer || 'No answer provided'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText className="w-16 h-16 mb-4" />
                <p className="text-lg">Select a response to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {filteredResponses && filteredResponses.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredResponses.length} of {responses?.length || 0} responses
        </div>
      )}
    </div>
  );
};

export default QuestionnaireResponses;
