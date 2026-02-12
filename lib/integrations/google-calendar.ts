import { google } from 'googleapis';
import { logger } from '@/lib/utils/logger';
import type { Event } from '@/lib/types/event.types';

/**
 * Get an authorized Google Calendar API client.
 */
function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Create a Google Calendar event from an app event.
 */
export async function createCalendarEvent(event: Event): Promise<string | null> {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
      logger.warn('Google Calendar not configured, skipping');
      return null;
    }

    const calendar = getCalendarClient();

    const startDateTime = event.time
      ? `${event.date}T${event.time}:00`
      : `${event.date}T09:00:00`;

    const endDateTime = event.time
      ? `${event.date}T${incrementTime(event.time)}:00`
      : `${event.date}T10:00:00`;

    const calendarEvent = {
      summary: `${getEventEmoji(event.type)} ${event.title}`,
      description: [
        event.description,
        event.person ? `Assigned to: ${event.person}` : null,
        `Type: ${event.type}`,
        `Priority: ${event.priority}`,
        `Created via WhatsApp AI Assistant`,
      ]
        .filter(Boolean)
        .join('\n'),
      location: event.location || undefined,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Kolkata',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 60 },
        ],
      },
      colorId: getCalendarColorId(event.type),
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: calendarEvent,
    });

    logger.info('Calendar event created', {
      eventId: event.id,
      calendarEventId: response.data.id,
    });

    return response.data.id || null;
  } catch (error) {
    logger.error('Failed to create calendar event', { error, eventId: event.id });
    return null;
  }
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteCalendarEvent(calendarEventId: string): Promise<boolean> {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
      return false;
    }

    const calendar = getCalendarClient();

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: calendarEventId,
    });

    logger.info('Calendar event deleted', { calendarEventId });
    return true;
  } catch (error) {
    logger.error('Failed to delete calendar event', { error, calendarEventId });
    return false;
  }
}

function getEventEmoji(type: string): string {
  const emojis: Record<string, string> = {
    flight: '✈️',
    hotel: '🏨',
    meeting: '📅',
    task: '✅',
    deadline: '🚨',
  };
  return emojis[type] || '📌';
}

function getCalendarColorId(type: string): string {
  // Google Calendar color IDs: 1-11
  const colors: Record<string, string> = {
    flight: '9',    // Blueberry
    hotel: '5',     // Banana
    meeting: '7',   // Peacock
    task: '10',     // Sage
    deadline: '11',  // Tomato
  };
  return colors[type] || '1';
}

function incrementTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const newHours = hours + 1;
  return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
