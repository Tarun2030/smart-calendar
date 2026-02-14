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

/* ---------------- HUMAN DAY (00:00–04:59 FIX) ---------------- */

function getHumanBaseDate(): Date {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

  // After midnight but before 5 AM still counts as yesterday
  if (ist.getHours() < 5) ist.setDate(ist.getDate() - 1);

  return ist;
}

function getISTDate(offsetDays = 0) {
  const base = getHumanBaseDate();
  base.setDate(base.getDate() + offsetDays);

  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/* ---------------- TIME PARSER ---------------- */

function extractTime12h(text: string): string | null {
  const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s?(am|pm)\b/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3].toLowerCase();

  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

/* ---------------- INTENT DETECTOR ---------------- */

function detectIntent(text: string) {
  const t = text.trim().toLowerCase();

  if (
    t.includes('schedule') ||
    t.includes('next') ||
    t.includes('upcoming') ||
    t.includes('show') ||
    t.includes('list') ||
    t === 'today' ||
    t === 'tomorrow' ||
    t === 'day after tomorrow'
  ) return 'QUERY';

  if (
    t.match(/\d{1,2}(:\d{2})?\s?(am|pm)/) ||
    t.includes('meeting') ||
    t.includes('call') ||
    t.includes('flight') ||
    t.includes('hotel') ||
    t.includes('deadline')
  ) return 'CREATE';

  return 'UNKNOWN';
}

/* ---------------- MAIN WEBHOOK ---------------- */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const lower = body.trim().toLowerCase();
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

    const intent = detectIntent(lower);

    /* ================= QUERY MODE ================= */

    if (intent === 'QUERY') {
      const start = getISTDate(0);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + 7);
      const end = endDate.toISOString().split('T')[0];

      const { data: events } = await supabase
        .from('events')
        .select('date, title, time')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (!events || events.length === 0)
        return twiml('No upcoming events');

      let msg = 'Upcoming:\n';

      const grouped = events.reduce((acc: any, e) => {
        if (!acc[e.date]) acc[e.date] = [];
        acc[e.date].push(e);
        return acc;
      }, {});

      for (const d in grouped) {
        msg += `\n${d}\n`;
        grouped[d].forEach((e: any) => {
          msg += e.time
            ? `• ${format12h(e.time)} — ${e.title}\n`
            : `• ${e.title}\n`;
        });
      }

      return twiml(msg.trim());
    }

    /* ================= CREATE MODE ================= */

    if (intent !== 'CREATE')
      return twiml('Try: meeting tomorrow 4pm');

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
