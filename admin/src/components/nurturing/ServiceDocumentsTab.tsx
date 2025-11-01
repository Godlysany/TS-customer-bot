import { useQuery } from '@tanstack/react-query';
import { FileText, Calendar, Clock, CheckCircle } from 'lucide-react';
import { nurturingApi } from '../../lib/api';

const ServiceDocumentsTab = () => {
  const { data: upcomingDocuments } = useQuery({
    queryKey: ['upcoming-documents'],
    queryFn: async () => {
      const res = await nurturingApi.getUpcomingDocuments();
      return res.data;
    },
  });

  const { data: documentHistory } = useQuery({
    queryKey: ['document-history'],
    queryFn: async () => {
      const res = await nurturingApi.getContactActivities('document_sent');
      return res.data;
    },
  });

  const getTimingLabel = (timing: string) => {
    switch (timing) {
      case 'as_info':
        return 'During Conversation';
      case 'on_confirmation':
        return 'On Booking Confirmation';
      case 'after_booking':
        return 'After Appointment Completed';
      default:
        return timing;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          Upcoming Document Deliveries
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Scheduled documents to be sent to customers based on their bookings
        </p>

        {upcomingDocuments && upcomingDocuments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timing</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {upcomingDocuments.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {doc.booking?.contact?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {doc.booking?.service?.name || 'Unknown Service'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-500" />
                      {doc.documentName || 'Document'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {getTimingLabel(doc.timing)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(doc.scheduledDate).toLocaleDateString()} at {new Date(doc.scheduledDate).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        doc.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        doc.status === 'sent' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No upcoming document deliveries scheduled</p>
            <p className="text-sm text-gray-400 mt-1">Documents will appear here based on customer bookings and service settings</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Document Delivery History
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Past documents sent to customers
        </p>

        {documentHistory && documentHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timing</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documentHistory.map((activity: any) => (
                  <tr key={activity.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {activity.contact?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {activity.metadata?.serviceName || 'Unknown Service'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-500" />
                      <a 
                        href={activity.metadata?.documentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {activity.metadata?.documentName || 'Document'}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(activity.createdAt).toLocaleDateString()} at {new Date(activity.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        {getTimingLabel(activity.metadata?.timing)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {activity.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No documents sent yet</p>
            <p className="text-sm text-gray-400 mt-1">Document history will appear here as they are sent to customers</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceDocumentsTab;
