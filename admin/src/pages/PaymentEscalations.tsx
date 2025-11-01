import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../lib/api';
import { DollarSign, AlertTriangle, TrendingUp, Users, Phone, Mail, CheckCircle } from 'lucide-react';

const PaymentEscalations = () => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'balance' | 'name' | 'date'>('balance');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['outstanding-balances'],
    queryFn: async () => {
      const res = await customersApi.getOutstandingBalances();
      return res.data;
    },
    refetchInterval: 60000,
  });

  const customers = data?.customers || [];
  const summary = data?.summary || { total_customers: 0, total_outstanding: 0 };

  const sortedCustomers = [...customers].sort((a, b) => {
    if (sortBy === 'balance') {
      return parseFloat(b.outstanding_balance_chf || 0) - parseFloat(a.outstanding_balance_chf || 0);
    } else if (sortBy === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    } else {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const filteredCustomers = sortedCustomers.filter(customer => {
    if (filterLevel === 'all') return true;
    if (filterLevel === 'high') return parseFloat(customer.outstanding_balance_chf || 0) > 200;
    if (filterLevel === 'medium') return parseFloat(customer.outstanding_balance_chf || 0) > 100 && parseFloat(customer.outstanding_balance_chf || 0) <= 200;
    if (filterLevel === 'low') return parseFloat(customer.outstanding_balance_chf || 0) <= 100;
    return true;
  });

  const getEscalationBadge = (balance: number) => {
    if (balance > 200) return { label: 'High', color: 'bg-red-100 text-red-800 border-red-200' };
    if (balance > 100) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: 'Low', color: 'bg-blue-100 text-blue-800 border-blue-200' };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-600" />
          Payment Escalations
        </h1>
        <p className="text-gray-600 mt-2">
          Manage customers with outstanding balances and payment issues
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Outstanding</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                CHF {summary.total_outstanding.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-red-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Customers with Debt</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {summary.total_customers}
              </p>
            </div>
            <Users className="w-12 h-12 text-gray-400 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Average Debt</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                CHF {summary.total_customers > 0 
                  ? (summary.total_outstanding / summary.total_customers).toFixed(2)
                  : '0.00'}
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-yellow-500 opacity-20" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Customer List</h2>
          <div className="flex gap-4">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="high">High (&gt; CHF 200)</option>
              <option value="medium">Medium (CHF 100-200)</option>
              <option value="low">Low (&lt; CHF 100)</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="balance">Sort by Balance</option>
              <option value="name">Sort by Name</option>
              <option value="date">Sort by Date</option>
            </select>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Outstanding Balances</h3>
            <p className="text-gray-500">All customers have cleared their payments!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allowance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer: any) => {
                  const badge = getEscalationBadge(parseFloat(customer.outstanding_balance_chf || 0));
                  const penalties = customer.pending_transactions?.filter((t: any) => t.is_penalty).length || 0;
                  const payments = customer.pending_transactions?.filter((t: any) => !t.is_penalty).length || 0;

                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">
                            Since {new Date(customer.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {customer.phone_number && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Phone className="w-3 h-3" />
                              {customer.phone_number}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Mail className="w-3 h-3" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-red-600">
                          CHF {parseFloat(customer.outstanding_balance_chf || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {penalties > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-red-50 text-red-700 text-xs mr-2">
                            {penalties} {penalties === 1 ? 'Penalty' : 'Penalties'}
                          </span>
                        )}
                        {payments > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-yellow-50 text-yellow-700 text-xs">
                            {payments} {payments === 1 ? 'Payment' : 'Payments'}
                          </span>
                        )}
                        {penalties === 0 && payments === 0 && (
                          <span className="text-gray-400">No pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.payment_allowance_granted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Granted
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => navigate(`/customers/${customer.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentEscalations;
