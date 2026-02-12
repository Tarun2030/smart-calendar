import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { parseRelativeDate } from '@/lib/utils/date';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EventExtractionSchema = z.object({
  type: z.enum(['flight', 'hotel', 'meeting', 'task', 'deadline']),
  title: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  person: z.string().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

export type ExtractedEvent = z.infer<typeof EventExtractionSchema>;

/**
 * Use OpenAI to extract structured event data from a WhatsApp message.
 */
export async function extractEventFromMessage(
  message: string,
  userPhone: string
): Promise<ExtractedEvent | null> {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    const systemPrompt = `You are an AI assistant that extracts event information from WhatsApp messages.

Current date: ${currentDate}
Current time: ${currentTime}

Extract the following information:
- type: flight, hotel, meeting, task, or deadline
- title: brief description (max 100 chars)
- date: YYYY-MM-DD format (handle relative dates like "tomorrow", "next Monday")
- time: HH:MM format in 24-hour (null if not mentioned)
- person: assigned person name (null if not mentioned)
- location: place/venue (null if not mentioned)
- description: additional context (null if not mentioned)
- priority: low/medium/high/urgent based on urgency indicators

Examples:
- "Flight to Mumbai tomorrow at 3 PM" → type: flight, date: tomorrow's date, time: 15:00
- "Meeting with Rahul next Monday at 10 AM in Bangalore" → type: meeting, person: Rahul, date: next Monday, time: 10:00, location: Bangalore
- "Hotel booking for Dec 25th, Taj Hotel Goa" → type: hotel, date: 2026-12-25, location: Taj Hotel Goa
- "URGENT: Submit report by Friday 5 PM" → type: deadline, priority: urgent, date: this Friday, time: 17:00

Return ONLY valid JSON matching the schema. If the message is unclear or not event-related, return null.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    // If the AI returned null explicitly
    if (parsed === null || parsed.type === undefined) return null;

    // Handle relative dates
    if (parsed.date) {
      parsed.date = parseRelativeDate(parsed.date, currentDate);
    }

    const validated = EventExtractionSchema.parse(parsed);

    logger.info('Event extracted', { message, extracted: validated });

    return validated;
  } catch (error) {
    logger.error('OpenAI extraction failed', { error, message });
    return null;
  }
}
