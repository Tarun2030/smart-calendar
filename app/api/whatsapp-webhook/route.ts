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

/* ---------------- HUMAN DAY DATE (MIDNIGHT FIX) ---------------- */

function getHumanBaseDate(): Date {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

  if (ist.getHours() < 5) ist.setDate(ist.getDate() - 1);
  return ist;
}

function getISTDate(offsetDays = 0) {
  const base = getHumanBaseDate();
  base.setDate(base.getDate() + offsetDays);

  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/* ---------------- 12H TIME PARSER ---------------- */

function extractTime12h(text: string): string | null {
  const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s?(am|pm)\b/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3].toLowerCase();

  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`;
}

/* ---------------- FORMATTER ---------------- */

function format12h(time: string) {
  const [h, m] = time.split(':');
  const hour = Number(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

/* ---------------- MAIN WEBHOOK ---------------- */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const phone = from.replace('whatsapp:', '');

    /* ---------- FIND OR CREATE USER ---------- */

    let userId: string | null = null;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .maybeSingle();

    if (existingUser) userId = existingUser.id;
    else {
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

    const lower = body.trim().toLowerCase();

    /* ---------------- SMART QUERY ENGINE ---------------- */

    async function listEvents(startOffset: number, endOffset: number, label: string) {
      const start = getISTDate(startOffset);
      const end = getISTDate(endOffset);

      const { data: events } = await supabase
        .from('events')
        .select('title, time, date')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (!events || events.length === 0)
        return twiml(`No events ${label}`);

      let currentDate = '';
      let text = `Your ${label}:\n`;

      for (const e of events) {
        if (e.date !== currentDate) {
          currentDate = e.date;
          text += `\n${currentDate}\n`;
        }

        text += e.time
          ? `• ${format12h(e.time)} — ${e.title}\n`
          : `• ${e.title}\n`;
      }

      return twiml(text.trim());
    }

    if (lower === 'today') return await listEvents(0, 0, 'today');
    if (lower === 'tomorrow') return await listEvents(1, 1, 'tomorrow');
    if (lower === 'day after tomorrow') return await listEvents(2, 2, 'day after tomorrow');
    if (lower.includes('next 7') || lower === 'schedule')
      return await listEvents(0, 7, 'next 7 days');

    /* ---------------- MULTI LINE EVENT CREATION ---------------- */

    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    let created: string[] = [];

    for (const line of lines) {
      const text = line.toLowerCase();

      let eventDate: string | null = null;
      if (text.includes('today')) eventDate = getISTDate(0);
      if (text.includes('tomorrow')) eventDate = getISTDate(1);
      if (text.includes('day after tomorrow')) eventDate = getISTDate(2);

      if (!eventDate) continue;

      const eventTime = extractTime12h(text);

      let type = 'task';
      if (text.includes('meeting')) type = 'meeting';
      if (text.includes('flight')) type = 'flight';
      if (text.includes('hotel')) type = 'hotel';
      if (text.includes('deadline')) type = 'deadline';

      await supabase.from('events').insert({
        user_id: userId,
        type,
        title: line,
        date: eventDate,
        time: eventTime,
        raw_message: line,
        whatsapp_phone: phone
      });

      created.push(`${type} on ${eventDate}${eventTime ? ` at ${format12h(eventTime)}` : ''}`);
    }

    if (created.length === 0)
      return twiml('Include a date like: today or tomorrow');

    return twiml(`Added:\n• ${created.join('\n• ')}`);

  } catch (error) {
    console.error(error);
    return twiml('Server error. Try again.');
  }
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
