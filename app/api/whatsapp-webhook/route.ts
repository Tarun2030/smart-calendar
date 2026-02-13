import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------- SUPABASE ---------------- */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ---------------- TWILIO XML ---------------- */

function twiml(message: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function GET() {
  return twiml('Webhook active');
}

/* ---------------- IST DATE ---------------- */

function getISTDate(offsetDays = 0) {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

  ist.setDate(ist.getDate() + offsetDays);

  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, '0');
  const day = String(ist.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/* ---------------- 12H TIME PARSER ---------------- */
/*
Supported:
4pm
4:30pm
04:05 am
at 7pm
*/

function extractTime12h(text: string): string | null {
  const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s?(am|pm)\b/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3].toLowerCase();

  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');

  return `${hh}:${mm}:00`;
}

/* ---------------- MAIN WEBHOOK ---------------- */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const lower = body.toLowerCase();

    const phone = from.replace('whatsapp:', '');

    /* ---------- FIND OR CREATE USER ---------- */

    let userId: string | null = null;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .maybeSingle();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ phone_number: phone })
        .select('id')
        .single();

      userId = newUser?.id || null;
    }

    /* ---------- LOG MESSAGE ---------- */

    await supabase.from('activity_logs').insert({
      user_id: userId,
      event_type: 'incoming_whatsapp',
      payload: { from, body },
      status: 'received'
    });

    /* ---------- QUERY: TODAY ---------- */

    if (lower.trim() === 'today') {
      const today = getISTDate(0);

      const { data: events } = await supabase
        .from('events')
        .select('title, time, type')
        .eq('user_id', userId)
        .eq('date', today)
        .order('time', { ascending: true });

      if (!events || events.length === 0) {
        return twiml('No events today');
      }

      const list = events.map(e => {
        if (e.time) {
          const [h, m] = e.time.split(':');
          const hour = Number(h);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour % 12 || 12;
          return `• ${displayHour}:${m} ${ampm} — ${e.title}`;
        }
        return `• ${e.title}`;
      }).join('\n');

      return twiml(`You have today:\n${list}`);
    }

    /* ---------- DATE ---------- */

    let eventDate: string | null = null;
    if (lower.includes('today')) eventDate = getISTDate(0);
    if (lower.includes('tomorrow')) eventDate = getISTDate(1);

    /* ---------- TIME ---------- */

    const eventTime = extractTime12h(lower);

    /* ---------- TYPE ---------- */

    let type = 'task';
    if (lower.includes('meeting')) type = 'meeting';
    if (lower.includes('flight')) type = 'flight';
    if (lower.includes('hotel')) type = 'hotel';
    if (lower.includes('deadline')) type = 'deadline';

    /* ---------- CREATE EVENT ---------- */

    if (eventDate && userId) {
      await supabase.from('events').insert({
        user_id: userId,
        type,
        title: body,
        date: eventDate,
        time: eventTime,
        raw_message: body,
        whatsapp_phone: phone
      });

      const timeText = eventTime
        ? ` at ${format12h(eventTime)}`
        : '';

      return twiml(`Added ${type} on ${eventDate}${timeText}`);
    }

    return twiml('Include a date like: today or tomorrow');

  } catch (error) {
    console.error(error);
    return twiml('Server error. Try again.');
  }
}

/* ---------------- FORMATTER ---------------- */

function format12h(time: string) {
  const [h, m] = time.split(':');
  const hour = Number(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

/* ---------------- XML SAFETY ---------------- */

function escapeXml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
