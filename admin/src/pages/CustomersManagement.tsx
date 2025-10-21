import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactApi } from '../lib/contact-api';
import { Plus, Upload, Download, X, Search, Edit2, Trash2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const CustomersManagement = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isMaster } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const getSentimentDisplay = (score: number | null) => {
    if (score === null || score === undefined) {
      return { label: 'Unknown', color: 'bg-gray-100 text-gray-700' };
    }
    if (score >= 0.3) return { label: 'Positive', color: 'bg-green-100 text-green-800' };
    if (score >= -0.3) return { label: 'Neutral', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Negative', color: 'bg-red-100 text-red-800' };
  };

  const [formData, setFormData] = useState({
    phone_number: '',
    name: '',
    email: '',
    preferred_language: '',
    notes: '',
    tags: ''
  });
  const [customLanguage, setCustomLanguage] = useState('');

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', sourceFilter],
    queryFn: async () => {
      const res = await contactApi.getAll(sourceFilter ? { source: sourceFilter } : {});
      return res.data;
    },
  });

  const { data: importBatches } = useQuery({
    queryKey: ['import-batches'],
    queryFn: async () => {
      const res = await contactApi.getImportBatches();
      return res.data;
    },
    enabled: isMaster,
  });

  const createMutation = useMutation({
    mutationFn: contactApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created successfully');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create contact');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => contactApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact updated successfully');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update contact');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: contactApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete contact');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: contactApi.bulkUpload,
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      setUploadProgress(null);
      
      const result = response.data;
      if (result.errors && result.errors.length > 0) {
        toast.error(`${result.successful_imports} imported, ${result.failed_imports} failed. Check errors.`);
        console.error('Import errors:', result.errors);
      } else {
        toast.success(`Successfully imported ${result.successful_imports} contacts`);
      }
    },
    onError: (error: any) => {
      setUploadProgress(null);
      toast.error(error.response?.data?.error || 'Upload failed');
    },
  });

  const resetForm = () => {
    setFormData({
      phone_number: '',
      name: '',
      email: '',
      preferred_language: '',
      notes: '',
      tags: ''
    });
    setCustomLanguage('');
    setShowCreateModal(false);
    setEditingContact(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      preferred_language: formData.preferred_language === 'custom' ? customLanguage : formData.preferred_language,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    };

    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (contact: any) => {
    setEditingContact(contact);
    setFormData({
      phone_number: contact.phone_number,
      name: contact.name || '',
      email: contact.email || '',
      preferred_language: contact.preferred_language || '',
      notes: contact.notes || '',
      tags: contact.tags?.join(', ') || ''
    });
    setShowCreateModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setUploadProgress('Uploading...');
    uploadMutation.mutate(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = 'phone_number,name,email,preferred_language,notes,tags\n+41791234567,Max Müller,max@example.com,de,VIP customer,vip;loyal\n+41797654321,Sophie Dubois,sophie@example.com,fr,New prospect,prospect';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
  };

  const filteredContacts = contacts?.filter((contact: any) => {
    const search = searchTerm.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(search) ||
      contact.phone_number?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-2">
            Manage contacts manually or import from CSV
          </p>
        </div>
        <div className="flex gap-3">
          {isMaster && (
            <>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Download className="w-5 h-5" />
                Download Template
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                disabled={uploadProgress !== null}
              >
                <Upload className="w-5 h-5" />
                {uploadProgress || 'Upload CSV'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Contact
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, phone, or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sources</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="manual">Manual</option>
            <option value="csv_import">CSV Import</option>
          </select>
        </div>
      </div>

      {importBatches && importBatches.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Imports</h3>
          <div className="space-y-2">
            {importBatches.slice(0, 3).map((batch: any) => (
              <div key={batch.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{batch.filename}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-green-600">{batch.successful_imports} imported</span>
                  {batch.failed_imports > 0 && (
                    <span className="text-red-600">{batch.failed_imports} failed</span>
                  )}
                  <span className="text-gray-500">{new Date(batch.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Language</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sentiment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredContacts?.map((contact: any) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {contact.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{contact.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(contact.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{contact.phone_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{contact.email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{contact.preferred_language || '-'}</td>
                  <td className="px-6 py-4">
                    {(() => {
                      const sentiment = getSentimentDisplay(contact.sentiment_score);
                      return (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${sentiment.color}`}>
                          {sentiment.label}
                          {contact.sentiment_score !== null && contact.sentiment_score !== undefined && (
                            <span className="ml-1 opacity-75">({contact.sentiment_score.toFixed(2)})</span>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      contact.source === 'whatsapp' ? 'bg-green-100 text-green-800' :
                      contact.source === 'manual' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {contact.source}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {contact.tags && contact.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.slice(0, 2).map((tag: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 2 && (
                          <span className="text-xs text-gray-500">+{contact.tags.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No tags</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(contact)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {isMaster && (
                        <button
                          onClick={() => {
                            if (confirm('Delete this contact?')) {
                              deleteMutation.mutate(contact.id);
                            }
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+41791234567"
                  disabled={!!editingContact}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Max Müller"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="max@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
                <select
                  value={formData.preferred_language}
                  onChange={(e) => {
                    setFormData({ ...formData, preferred_language: e.target.value });
                    if (e.target.value !== 'custom') setCustomLanguage('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="de">German (de)</option>
                  <option value="fr">French (fr)</option>
                  <option value="it">Italian (it)</option>
                  <option value="en">English (en)</option>
                  <option value="es">Spanish (es)</option>
                  <option value="pt">Portuguese (pt)</option>
                  <option value="custom">Custom Language...</option>
                </select>
                {formData.preferred_language === 'custom' && (
                  <input
                    type="text"
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mt-2"
                    placeholder="Enter custom language code (e.g., zh, ar, ru)"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="vip, loyal, prospect"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional notes about this contact..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Contact'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersManagement;
