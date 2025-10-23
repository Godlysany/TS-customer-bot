import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promotionApi } from '../lib/promotion-api';
import { Plus, Edit2, Trash2, Percent, Tag, TrendingUp, X } from 'lucide-react';
import toast from 'react-hot-toast';

const Promotions = () => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    service_id: '',
    discount_type: 'fixed' as 'fixed' | 'percentage',
    discount_value: '',
    voucher_code: '',
    valid_from: '',
    valid_until: '',
    usage_limit: '',
    bot_can_offer_autonomous: false,
  });

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const res = await promotionApi.getAll();
      return res.data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await fetch('/api/services/all');
      const data = await res.json();
      return data.data;
    },
  });

  const { data: performance } = useQuery({
    queryKey: ['promotion-performance'],
    queryFn: async () => {
      const res = await promotionApi.getPerformance();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: promotionApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-performance'] });
      toast.success('Promotion created successfully');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create promotion');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => promotionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promotion updated successfully');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update promotion');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: promotionApi.deactivate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promotion deactivated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to deactivate');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      service_id: '',
      discount_type: 'fixed',
      discount_value: '',
      voucher_code: '',
      valid_from: '',
      valid_until: '',
      usage_limit: '',
      bot_can_offer_autonomous: false,
    });
    setShowCreateModal(false);
    setEditingPromotion(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: formData.name,
      description: formData.description,
      service_id: formData.service_id || null,
      discount_type: formData.discount_type === 'fixed' ? 'fixed_chf' : 'percentage',
      discount_value: parseFloat(formData.discount_value),
      voucher_code: formData.voucher_code || null,
      valid_from: formData.valid_from || undefined,
      valid_until: formData.valid_until || null,
      max_uses: formData.usage_limit ? parseInt(formData.usage_limit) : null,
      bot_can_offer: formData.bot_can_offer_autonomous,
      bot_max_chf: 20,
      requires_admin_approval: true,
      is_active: true,
      promotion_type: 'service_discount',
      applies_to_all_services: !formData.service_id,
      code_required: !!formData.voucher_code,
      max_uses_per_customer: 1,
    };

    if (editingPromotion) {
      updateMutation.mutate({ id: editingPromotion.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (promotion: any) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      description: promotion.description || '',
      service_id: promotion.service_id || '',
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value.toString(),
      voucher_code: promotion.voucher_code || '',
      valid_from: promotion.valid_from ? new Date(promotion.valid_from).toISOString().split('T')[0] : '',
      valid_until: promotion.valid_until ? new Date(promotion.valid_until).toISOString().split('T')[0] : '',
      usage_limit: promotion.usage_limit?.toString() || '',
      bot_can_offer_autonomous: promotion.bot_can_offer_autonomous || false,
    });
    setShowCreateModal(true);
  };

  const generateVoucherCode = () => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    setFormData({ ...formData, voucher_code: code });
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promotions & Discounts</h1>
          <p className="text-gray-600 mt-2">
            Manage promotional campaigns and discount codes
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Create Promotion
        </button>
      </div>

      {performance && performance.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {performance.slice(0, 4).map((promo: any) => (
            <div key={promo.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900 truncate">{promo.name}</h3>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{promo.total_usage || 0}</p>
              <p className="text-xs text-gray-500">uses • {promo.total_discount_given || 0} CHF saved</p>
            </div>
          ))}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {promotions?.map((promo: any) => (
                <tr key={promo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{promo.name}</p>
                      <p className="text-xs text-gray-500">{promo.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-gray-900">
                        {promo.discount_type === 'fixed' 
                          ? `${promo.discount_value} CHF` 
                          : `${promo.discount_value}%`}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {promo.voucher_code ? (
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-blue-600" />
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {promo.voucher_code}
                        </code>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No code</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-gray-600">
                      {promo.valid_from && <div>From: {new Date(promo.valid_from).toLocaleDateString()}</div>}
                      {promo.valid_until && <div>Until: {new Date(promo.valid_until).toLocaleDateString()}</div>}
                      {!promo.valid_from && !promo.valid_until && <span className="text-gray-400">No limits</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {promo.usage_count || 0}
                      {promo.usage_limit && ` / ${promo.usage_limit}`}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {promo.is_active ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(promo)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {promo.is_active && (
                        <button
                          onClick={() => {
                            if (confirm('Deactivate this promotion?')) {
                              deactivateMutation.mutate(promo.id);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPromotion ? 'Edit Promotion' : 'Create New Promotion'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Summer Sale 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Special summer discount for all services"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service (optional)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  💡 <strong>Pre-Booking Discount:</strong> Link to a specific service to offer this promotion when customers book that service. Leave blank to apply to all services. This is NOT for post-service nurturing.
                </p>
                <select
                  value={formData.service_id}
                  onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All services</option>
                  {services?.map((service: any) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="fixed">Fixed (CHF)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={formData.discount_type === 'fixed' ? '20.00' : '10'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.voucher_code}
                    onChange={(e) => setFormData({ ...formData, voucher_code: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="SUMMER2025"
                  />
                  <button
                    type="button"
                    onClick={generateVoucherCode}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit (optional)</label>
                <input
                  type="number"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bot_autonomous"
                  checked={formData.bot_can_offer_autonomous}
                  onChange={(e) => setFormData({ ...formData, bot_can_offer_autonomous: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="bot_autonomous" className="text-sm text-gray-700">
                  Allow bot to offer this promotion autonomously
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Promotion'}
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

export default Promotions;
