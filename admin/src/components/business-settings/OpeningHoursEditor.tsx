import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessHoursApi } from '../../lib/api';
import { Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface BusinessHour {
  id?: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
}

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const OpeningHoursEditor = () => {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<Record<number, BusinessHour>>({});

  const { data: existingHours, isLoading } = useQuery({
    queryKey: ['business-hours'],
    queryFn: async () => {
      const res = await businessHoursApi.getAll();
      return res.data;
    },
  });

  useEffect(() => {
    if (existingHours) {
      const hoursMap: Record<number, BusinessHour> = {};
      existingHours.forEach((hour: BusinessHour) => {
        hoursMap[hour.dayOfWeek] = hour;
      });
      setHours(hoursMap);
    }
  }, [existingHours]);

  const saveMutation = useMutation({
    mutationFn: async (hoursData: BusinessHour[]) => {
      await businessHoursApi.replaceAll(hoursData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours'] });
      toast.success('Opening hours saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save opening hours');
    },
  });

  const handleTimeChange = (
    day: number,
    field: 'openTime' | 'closeTime' | 'breakStartTime' | 'breakEndTime',
    value: string
  ) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        dayOfWeek: day,
        [field]: value || null,
      },
    }));
  };

  const toggleDay = (day: number, enabled: boolean) => {
    if (enabled) {
      setHours((prev) => ({
        ...prev,
        [day]: {
          dayOfWeek: day,
          openTime: '09:00',
          closeTime: '18:00',
          breakStartTime: null,
          breakEndTime: null,
        },
      }));
    } else {
      setHours((prev) => {
        const newHours = { ...prev };
        delete newHours[day];
        return newHours;
      });
    }
  };

  const toggleBreak = (day: number, enabled: boolean) => {
    if (enabled) {
      setHours((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          breakStartTime: '12:00',
          breakEndTime: '13:00',
        },
      }));
    } else {
      setHours((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          breakStartTime: null,
          breakEndTime: null,
        },
      }));
    }
  };

  const validateTimes = (): boolean => {
    for (const [day, dayHours] of Object.entries(hours)) {
      const dayName = DAYS.find((d) => d.value === Number(day))?.label;

      if (dayHours.openTime >= dayHours.closeTime) {
        toast.error(`${dayName}: Closing time must be after opening time`);
        return false;
      }

      if (dayHours.breakStartTime && dayHours.breakEndTime) {
        if (dayHours.breakStartTime >= dayHours.breakEndTime) {
          toast.error(`${dayName}: Break end time must be after break start time`);
          return false;
        }

        if (dayHours.breakStartTime < dayHours.openTime || dayHours.breakEndTime > dayHours.closeTime) {
          toast.error(`${dayName}: Break period must fall within opening hours`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = () => {
    if (!validateTimes()) {
      return;
    }
    const hoursArray = Object.values(hours);
    saveMutation.mutate(hoursArray);
  };

  const copyToAll = (sourceDay: number) => {
    const sourceHours = hours[sourceDay];
    if (!sourceHours) return;

    const newHours: Record<number, BusinessHour> = {};
    DAYS.forEach(({ value }) => {
      newHours[value] = {
        dayOfWeek: value,
        openTime: sourceHours.openTime,
        closeTime: sourceHours.closeTime,
        breakStartTime: sourceHours.breakStartTime,
        breakEndTime: sourceHours.breakEndTime,
      };
    });
    setHours(newHours);
    toast.success(`Copied ${DAYS.find((d) => d.value === sourceDay)?.label} hours to all days`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-2">Structured Opening Hours</p>
            <p className="mb-1">
              These are the actual business hours used for booking validation. Configure when your business is open for each day, including break periods.
            </p>
            <p className="text-xs text-blue-800 mt-2">
              The bot will automatically prevent bookings outside these hours and ensure appointments don't span break periods.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {DAYS.map(({ value, label }) => {
          const dayHours = hours[value];
          const isOpen = !!dayHours;
          const hasBreak = !!(dayHours?.breakStartTime && dayHours?.breakEndTime);

          return (
            <div
              key={value}
              className={`border rounded-lg p-4 transition-colors ${
                isOpen ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => toggleDay(value, e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label className="text-sm font-semibold text-gray-900">{label}</label>
                </div>
                {isOpen && (
                  <button
                    type="button"
                    onClick={() => copyToAll(value)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Copy to All Days
                  </button>
                )}
              </div>

              {isOpen && dayHours && (
                <div className="space-y-3 pl-7">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <input
                        type="time"
                        value={dayHours.openTime}
                        onChange={(e) => handleTimeChange(value, 'openTime', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <span className="text-gray-500 text-sm">to</span>
                    <input
                      type="time"
                      value={dayHours.closeTime}
                      onChange={(e) => handleTimeChange(value, 'closeTime', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={hasBreak}
                        onChange={(e) => toggleBreak(value, e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label className="text-xs font-medium text-gray-700">
                        Has break period (e.g., lunch break)
                      </label>
                    </div>

                    {hasBreak && (
                      <div className="flex items-center gap-3 pl-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Break from</span>
                          <input
                            type="time"
                            value={dayHours.breakStartTime || ''}
                            onChange={(e) => handleTimeChange(value, 'breakStartTime', e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <span className="text-gray-500 text-sm">to</span>
                        <input
                          type="time"
                          value={dayHours.breakEndTime || ''}
                          onChange={(e) => handleTimeChange(value, 'breakEndTime', e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isOpen && (
                <p className="text-xs text-gray-500 italic pl-7">Closed on this day</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || Object.keys(hours).length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Clock className="w-5 h-5" />
          {saveMutation.isPending ? 'Saving...' : 'Save Opening Hours'}
        </button>
      </div>
    </div>
  );
};

export default OpeningHoursEditor;
