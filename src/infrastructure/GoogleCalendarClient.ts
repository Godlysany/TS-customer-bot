import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import settingsService from '../core/SettingsService';
import { CalendarProvider, CalendarEvent, TimeSlot } from '../types';

export class GoogleCalendarClient implements CalendarProvider {
  private oauth2Client: OAuth2Client;
  private calendar: any;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:8080'}/api/calendar/oauth/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async initialize() {
    try {
      const accessToken = await settingsService.getSetting('google_calendar_access_token');
      const refreshToken = await settingsService.getSetting('google_calendar_refresh_token');
      const expiryDate = await settingsService.getSetting('google_calendar_token_expiry');

      if (!accessToken || !refreshToken) {
        throw new Error('Google Calendar not connected. Please connect via Settings page.');
      }

      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry_date: expiryDate ? parseInt(expiryDate) : undefined,
      });

      // Auto-refresh token when it expires
      this.oauth2Client.on('tokens', async (tokens) => {
        if (tokens.access_token) {
          await settingsService.updateSetting('google_calendar_access_token', tokens.access_token);
        }
        if (tokens.refresh_token) {
          await settingsService.updateSetting('google_calendar_refresh_token', tokens.refresh_token);
        }
        if (tokens.expiry_date) {
          await settingsService.updateSetting('google_calendar_token_expiry', tokens.expiry_date.toString());
        }
        console.log('🔄 Google Calendar token refreshed');
      });

      console.log('✅ Google Calendar client initialized');
      return true;
    } catch (error: any) {
      console.warn('⚠️ Could not initialize Google Calendar:', error.message);
      return false;
    }
  }

  async createEvent(event: CalendarEvent, calendarId: string = 'primary'): Promise<string> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: calendarId,
        requestBody: {
          summary: event.title,
          description: event.description || '',
          start: {
            dateTime: event.startTime.toISOString(),
            timeZone: 'Europe/Zurich', // CET timezone for Swiss market
          },
          end: {
            dateTime: event.endTime.toISOString(),
            timeZone: 'Europe/Zurich',
          },
          attendees: event.attendees?.map(email => ({ email })),
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 },
              { method: 'popup', minutes: 120 },
            ],
          },
        },
      });

      console.log(`✅ Calendar event created: ${response.data.id} (calendar: ${calendarId})`);
      return response.data.id!;
    } catch (error: any) {
      console.error('❌ Failed to create calendar event:', error.message);
      throw new Error(`Failed to create calendar event: ${error.message}`);
    }
  }

  async updateEvent(eventId: string, event: Partial<CalendarEvent>, calendarId: string = 'primary'): Promise<void> {
    try {
      const updateData: any = {};

      if (event.title) updateData.summary = event.title;
      if (event.description) updateData.description = event.description;
      if (event.startTime) {
        updateData.start = {
          dateTime: event.startTime.toISOString(),
          timeZone: 'Europe/Zurich',
        };
      }
      if (event.endTime) {
        updateData.end = {
          dateTime: event.endTime.toISOString(),
          timeZone: 'Europe/Zurich',
        };
      }
      if (event.attendees) {
        updateData.attendees = event.attendees.map(email => ({ email }));
      }

      await this.calendar.events.patch({
        calendarId: calendarId,
        eventId,
        requestBody: updateData,
      });

      console.log(`✅ Calendar event updated: ${eventId} (calendar: ${calendarId})`);
    } catch (error: any) {
      console.error('❌ Failed to update calendar event:', error.message);
      throw new Error(`Failed to update calendar event: ${error.message}`);
    }
  }

  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: calendarId,
        eventId,
      });

      console.log(`✅ Calendar event deleted: ${eventId} (calendar: ${calendarId})`);
    } catch (error: any) {
      console.error('❌ Failed to delete calendar event:', error.message);
      throw new Error(`Failed to delete calendar event: ${error.message}`);
    }
  }

  async getAvailability(startDate: Date, endDate: Date, calendarId: string = 'primary'): Promise<TimeSlot[]> {
    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          items: [{ id: calendarId }],
          timeZone: 'Europe/Zurich',
        },
      });

      const busySlots = response.data.calendars?.[calendarId]?.busy || [];
      const allSlots: TimeSlot[] = [];

      // Generate all possible 30-minute slots
      const current = new Date(startDate);
      while (current < endDate) {
        const slotEnd = new Date(current);
        slotEnd.setMinutes(slotEnd.getMinutes() + 30);

        const isBusy = busySlots.some((busy: any) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (current >= busyStart && current < busyEnd) ||
                 (slotEnd > busyStart && slotEnd <= busyEnd);
        });

        allSlots.push({
          start: new Date(current),
          end: new Date(slotEnd),
          available: !isBusy,
        });

        current.setMinutes(current.getMinutes() + 30);
      }

      return allSlots;
    } catch (error: any) {
      console.error('❌ Failed to get calendar availability:', error.message);
      throw new Error(`Failed to get calendar availability: ${error.message}`);
    }
  }
}
