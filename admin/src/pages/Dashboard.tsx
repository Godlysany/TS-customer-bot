import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, reviewApi } from '../lib/api';

type TimeFrame = 'today' | 'week' | 'month' | 'all';

export default function Dashboard() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('today');

  const getDateRange = () => {
    const now = new Date();
    const start = new Date();
    
    switch (timeFrame) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'all':
        return { startDate: undefined, endDate: undefined };
    }
    
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  };

  const { startDate, endDate } = getDateRange();

  const { data: statsResponse } = useQuery({
    queryKey: ['dashboard-stats', timeFrame],
    queryFn: async () => {
      const response = await dashboardApi.getStats(startDate, endDate);
      return response.data;
    },
  });

  const { data: reviewStatsResponse } = useQuery({
    queryKey: ['review-stats', timeFrame],
    queryFn: async () => {
      const response = await reviewApi.getStats(startDate, endDate);
      return response.data;
    },
  });

  const stats = statsResponse;
  const reviewStats = reviewStatsResponse;

  const timeFrameLabels = {
    today: 'Today',
    week: 'Last 7 Days',
    month: 'Last 30 Days',
    all: 'All Time',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          {(Object.keys(timeFrameLabels) as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-4 py-2 rounded ${
                timeFrame === tf
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {timeFrameLabels[tf]}
            </button>
          ))}
        </div>
      </div>

      {/* Booking Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Bookings</h3>
          <p className="text-3xl font-bold">{stats?.total || 0}</p>
          <div className="mt-2 text-sm text-gray-600">
            <span className="text-green-600">{stats?.confirmed || 0} confirmed</span>
            {' • '}
            <span className="text-red-600">{stats?.cancelled || 0} cancelled</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Cancellation Rate</h3>
          <p className="text-3xl font-bold">{stats?.cancellationRate?.toFixed(1) || 0}%</p>
          <div className="mt-2 text-sm text-gray-600">
            {stats?.penaltiesApplied || 0} late cancellations
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Financial Summary</h3>
          <p className="text-lg font-bold text-green-600">+€{stats?.totalPenaltyFees || '0.00'}</p>
          <p className="text-sm text-gray-600">Penalty Fees Collected</p>
          <p className="text-lg font-bold text-red-600 mt-2">-€{stats?.totalDiscounts || '0.00'}</p>
          <p className="text-sm text-gray-600">Discounts Given</p>
        </div>
      </div>

      {/* Review Stats */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-lg font-semibold mb-4">Review Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Reviews</h3>
            <p className="text-2xl font-bold">{reviewStats?.total || 0}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Submitted</h3>
            <p className="text-2xl font-bold">{reviewStats?.submitted || 0}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Submission Rate</h3>
            <p className="text-2xl font-bold">{reviewStats?.submissionRate?.toFixed(1) || 0}%</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Average Rating</h3>
            <p className="text-2xl font-bold">{reviewStats?.averageRating || 'N/A'} ⭐</p>
          </div>
        </div>

        {reviewStats?.ratings && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Rating Distribution</h3>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map(rating => (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-sm w-12">{rating} ⭐</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-yellow-400 h-4 rounded-full"
                      style={{
                        width: `${reviewStats.total > 0 ? (reviewStats.ratings[rating] / reviewStats.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                  <span className="text-sm w-12 text-right">{reviewStats.ratings[rating] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <h3 className="font-semibold mb-1">View Waitlist</h3>
            <p className="text-sm text-gray-600">Manage appointment queue</p>
          </button>
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <h3 className="font-semibold mb-1">Pending Reviews</h3>
            <p className="text-sm text-gray-600">Follow up on feedback</p>
          </button>
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <h3 className="font-semibold mb-1">Send Campaign</h3>
            <p className="text-sm text-gray-600">Start marketing outreach</p>
          </button>
        </div>
      </div>
    </div>
  );
}
