import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateTwilioSignature } from '@/lib/integrations/twilio';
import { extractEventFromMessage } from '@/lib/integrations/openai';
import { createEvent, updateEvent } from '@/lib/supabase/queries';
import { createCalendarEvent } from '@/lib/integrations/google-calendar';
import { sendWhatsAppMessage } from '@/lib/integrations/twilio';
import { logger } from '@/lib/utils/logger';
import { rateLimit } from '@/lib/utils/rate-limiter';
import { formatDate } from '@/lib/utils/date';

const WebhookSchema = z.object({
  From: z.string(),
  Body: z.string(),
  MessageSid: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (100 requests per minute per phone number)
    const rateLimitResult = await rateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Validate Twilio signature for security
    const isValid = await validateTwilioSignature(request);
    if (!isValid) {
      logger.error('Invalid Twilio signature');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const data = {
      From: formData.get('From'),
      Body: formData.get('Body'),
      MessageSid: formData.get('MessageSid'),
    };

    const validated = WebhookSchema.parse(data);
    const phoneNumber = validated.From.replace('whatsapp:', '');

    logger.info('WhatsApp message received', {
      phoneNumber,
      messageId: validated.MessageSid,
    });

    // Extract event details using OpenAI
    const extractedEvent = await extractEventFromMessage(
      validated.Body,
      phoneNumber
    );

    if (!extractedEvent) {
      await sendWhatsAppMessage(
        phoneNumber,
        "Sorry, I couldn't understand that message. Please try again with details like date, time, and what the event is about."
      );
      return NextResponse.json({
        status: 'error',
        message: 'Extraction failed',
      });
    }

    // Save to Supabase
    const event = await createEvent({
      ...extractedEvent,
      raw_message: validated.Body,
      whatsapp_phone: phoneNumber,
    });

    // Create Google Calendar event
    if (event.date) {
      try {
        const calendarEventId = await createCalendarEvent(event);
        if (calendarEventId) {
          await updateEvent(event.id, {
            calendar_event_id: calendarEventId,
          });
        }
      } catch (calError) {
        logger.error('Calendar event creation failed', { error: calError });
        // Non-critical, continue with confirmation
      }
    }

    // Send confirmation
    const confirmationMessage = formatConfirmationMessage(event);
    await sendWhatsAppMessage(phoneNumber, confirmationMessage);

    logger.info('Event created successfully', { eventId: event.id });

    return NextResponse.json({ status: 'success', eventId: event.id });
  } catch (error) {
    logger.error('Webhook error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Verify endpoint for Twilio webhook setup
export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook is active' });
}

function formatConfirmationMessage(event: Record<string, unknown>): string {
  const emoji = getEventEmoji(event.type as string);
  const parts = [
    `${emoji} Got it! I've saved this event:`,
    '',
    `📝 ${event.title}`,
    `📅 ${formatDate(event.date as string)}`,
  ];

  if (event.time) parts.push(`🕐 ${event.time}`);
  if (event.person) parts.push(`👤 Assigned to: ${event.person}`);
  if (event.location) parts.push(`📍 ${event.location}`);

  parts.push('');
  parts.push('Added to your calendar and dashboard!');

  return parts.join('\n');
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
