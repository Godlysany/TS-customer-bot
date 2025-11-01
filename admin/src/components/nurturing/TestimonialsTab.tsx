import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';
import { nurturingApi } from '../../lib/api';
import toast from 'react-hot-toast';

const TestimonialsTab = () => {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['nurturing-settings'],
    queryFn: async () => {
      const res = await nurturingApi.getSettings();
      return res.data;
    },
  });

  const { data: reviewHistory } = useQuery({
    queryKey: ['review-history'],
    queryFn: async () => {
      const res = await nurturingApi.getContactActivities('review_request');
      return res.data;
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => 
      nurturingApi.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing-settings'] });
      toast.success('Setting updated successfully');
    },
    onError: () => {
      toast.error('Failed to update setting');
    },
  });

  const handleSettingChange = (key: string, value: string) => {
    updateSettingMutation.mutate({ key, value });
  };

  const getSetting = (key: string): string => {
    const setting = settings?.find((s: any) => s.settingKey === key);
    return setting?.settingValue || '';
  };

  const enableReviews = getSetting('enable_review_requests') === 'true';
  const enableGoogleReview = getSetting('enable_google_review_followup') === 'true';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-500" />
          Testimonial Request Settings
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Automatically request testimonials from customers after their appointments
        </p>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Enable Testimonial Requests</h3>
              <p className="text-xs text-gray-500 mt-1">Send automated review requests after appointments</p>
            </div>
            <button
              onClick={() => handleSettingChange('enable_review_requests', (!enableReviews).toString())}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enableReviews ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enableReviews ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {enableReviews && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Request Delay (hours)
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="24"
                  value={getSetting('review_request_delay_hours')}
                  onChange={(e) => handleSettingChange('review_request_delay_hours', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Wait time after appointment before sending testimonial request
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Testimonial Request Message Template
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Hi {name}! We hope you enjoyed your {service} appointment. We'd love to hear your feedback..."
                  value={getSetting('review_request_template')}
                  onChange={(e) => handleSettingChange('review_request_template', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available placeholders: {'{name}'}, {'{service}'}, {'{date}'}
                </p>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Google Review Follow-Up (for Positive Testimonials)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Automatically send Google Review request when customer provides positive feedback
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Enable Google Review Follow-Up</h4>
                      <p className="text-xs text-gray-500 mt-1">Uses AI sentiment analysis to detect positive reviews</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('enable_google_review_followup', (!enableGoogleReview).toString())}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enableGoogleReview ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enableGoogleReview ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {enableGoogleReview && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Google Review Link
                        </label>
                        <input
                          type="url"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="https://g.page/r/YOUR_REVIEW_LINK"
                          value={getSetting('google_review_link')}
                          onChange={(e) => handleSettingChange('google_review_link', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Get your review link from Google Business Profile → Get more reviews
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Google Review Request Delay (minutes)
                        </label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="5"
                          value={getSetting('google_review_request_delay_minutes')}
                          onChange={(e) => handleSettingChange('google_review_request_delay_minutes', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Wait time after positive testimonial before requesting Google review
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Google Review Request Message Template
                        </label>
                        <textarea
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                          placeholder="Thank you for your kind words! Would you mind sharing your experience on Google? {link}"
                          value={getSetting('google_review_request_template')}
                          onChange={(e) => handleSettingChange('google_review_request_template', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Available placeholders: {'{name}'}, {'{link}'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Testimonials History</h2>
        <p className="text-sm text-gray-600 mb-4">
          Past testimonial requests and customer responses
        </p>

        {reviewHistory && reviewHistory.length > 0 ? (
          <div className="space-y-4">
            {reviewHistory.map((activity: any) => (
              <div key={activity.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{activity.contact?.name || 'Unknown'}</h3>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.createdAt).toLocaleDateString()} at {new Date(activity.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activity.metadata?.googleReviewSent && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Google Review Requested
                      </span>
                    )}
                    {activity.metadata?.sentiment === 'positive' && (
                      <ThumbsUp className="w-4 h-4 text-green-600" />
                    )}
                    {activity.metadata?.sentiment === 'negative' && (
                      <ThumbsDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-gray-600 font-medium">Request Sent:</p>
                  <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-2 rounded">{activity.details}</p>
                </div>

                {activity.metadata?.customerReply && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <p className="text-sm text-gray-600 font-medium">Customer Response:</p>
                    <p className="text-sm text-gray-900 mt-1 bg-blue-50 p-3 rounded italic">
                      "{activity.metadata.customerReply}"
                    </p>
                    {activity.metadata.sentimentScore && (
                      <p className="text-xs text-gray-500 mt-2">
                        Sentiment Score: {activity.metadata.sentimentScore.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {!activity.metadata?.customerReply && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <p className="text-sm text-gray-500 italic">No response received yet</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No testimonial requests sent yet</p>
        )}
      </div>
    </div>
  );
};

export default TestimonialsTab;
