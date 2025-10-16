import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../lib/api';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

const WhatsAppBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  const { data: whatsappStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => {
      const res = await settingsApi.getWhatsAppStatus();
      return res.data;
    },
    refetchInterval: 10000, // Check every 10 seconds
  });

  if (dismissed || whatsappStatus?.connected) {
    return null;
  }

  return (
    <div className="bg-red-600 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <p className="font-semibold">WhatsApp Disconnected</p>
            <p className="text-sm text-red-100">
              Bot cannot send/receive messages. Go to Settings → WhatsApp Connection to reconnect.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-red-700 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default WhatsAppBanner;
