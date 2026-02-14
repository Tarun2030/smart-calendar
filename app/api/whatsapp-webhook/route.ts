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

/* =========================================================
   HUMAN DAY ENGINE  (single clock per request)
   00:00–04:59 counts as previous day
========================================================= */

function getHumanTodayIST(): Date {
  const utc = new Date();
  const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);

  if (ist.getHours() < 5) {
    ist.setDate(ist.getDate() - 1);
  }

  ist.setHours(0, 0, 0, 0);
  return ist;
}

function addDays(base: Date, days: number) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${da}`;
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

    /* ---------- FREEZE HUMAN DAY ---------- */

    const humanToday = getHumanTodayIST();

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

    /* ---------- QUERY TODAY ---------- */

    if (lower === 'today') {
      const today = addDays(humanToday, 0);

      const { data: events } = await supabase
        .from('events')
        .select('title, time, type')
        .eq('user_id', userId)
        .eq('date', today)
        .order('time', { ascending: true });

      if (!events || events.length === 0)
        return twiml('No events today');

      const list = events.map(e =>
        e.time ? `• ${format12h(e.time)} — ${e.title}` : `• ${e.title}`
      ).join('\n');

      return twiml(`You have today:\n${list}`);
    }

    /* ---------- MULTI LINE EVENT CREATION ---------- */

    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    let created: string[] = [];

    for (const line of lines) {
      const text = line.toLowerCase();

      let eventDate: string | null = null;

      if (text.includes('day after tomorrow'))
        eventDate = addDays(humanToday, 2);
      else if (text.includes('tomorrow'))
        eventDate = addDays(humanToday, 1);
      else if (text.includes('today'))
        eventDate = addDays(humanToday, 0);

      if (!eventDate) continue;

      const eventTime = extractTime12h(text);

      let type = 'task';
      if (text.includes('meeting')) type = 'meeting';
      if (text.includes('flight')) type = 'flight';
      if (text.includes('hotel')) type = 'hotel';
      if (text.includes('deadline')) type = 'deadline';
      if (text.includes('call')) type = 'call';

      await supabase.from('events').insert({
        user_id: userId,
        type,
        title: line,
        date: eventDate,
        time: eventTime,
        raw_message: line,
        whatsapp_phone: phone
      });

      created.push(
        `${type} on ${eventDate}${eventTime ? ` at ${format12h(eventTime)}` : ''}`
      );
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
