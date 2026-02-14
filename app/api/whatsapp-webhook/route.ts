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

/* ---------------- IST DATE SAFE ---------------- */
/*
Human day: before 5AM counts as previous day
No Date mutation, deterministic for Vercel
*/

function getISTNow(): Date {
  const utc = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(utc.getTime() + istOffset);
}

function getISTDate(offsetDays = 0) {
  const ist = getISTNow();

  const base = new Date(ist.getTime());
  if (base.getHours() < 5) base.setDate(base.getDate() - 1);

  const target = new Date(base.getTime());
  target.setDate(target.getDate() + offsetDays);

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');

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

  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`;
}

/* ---------------- MAIN WEBHOOK ---------------- */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const phone = from.replace('whatsapp:', '');
    const lower = body.trim().toLowerCase();

    /* ---------- USER ---------- */

    let userId: string | null = null;

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .maybeSingle();

    if (existing) userId = existing.id;
    else {
      const { data } = await supabase
        .from('users')
        .insert({ phone_number: phone })
        .select('id')
        .single();

      userId = data?.id || null;
    }

    /* ---------- LOG ---------- */

    await supabase.from('activity_logs').insert({
      user_id: userId,
      event_type: 'incoming_whatsapp',
      payload: { from, body },
      status: 'received'
    });

    /* ---------- TODAY QUERY ---------- */

    if (lower === 'today') {
      const today = getISTDate(0);

      const { data: events } = await supabase
        .from('events')
        .select('title,time,type')
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

    /* ---------- MULTILINE EVENTS ---------- */

    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    const created: string[] = [];

    for (const line of lines) {
      const text = line.toLowerCase();

      let date: string | null = null;
      if (text.includes('today')) date = getISTDate(0);
      if (text.includes('tomorrow')) date = getISTDate(1);
      if (!date) continue;

      const time = extractTime12h(text);

      let type = 'task';
      if (text.includes('meeting')) type = 'meeting';
      if (text.includes('flight')) type = 'flight';
      if (text.includes('hotel')) type = 'hotel';
      if (text.includes('deadline')) type = 'deadline';

      await supabase.from('events').insert({
        user_id: userId,
        type,
        title: line,
        date,
        time,
        raw_message: line,
        whatsapp_phone: phone
      });

      created.push(`${type} on ${date}${time ? ` at ${format12h(time)}` : ''}`);
    }

    if (!created.length)
      return twiml('Include a date like: today or tomorrow');

    return twiml(`Added:\n• ${created.join('\n• ')}`);

  } catch (err) {
    console.error(err);
    return twiml('Server error. Try again.');
  }
}

/* ---------------- FORMAT ---------------- */

function format12h(time: string) {
  const [h, m] = time.split(':');
  const hour = Number(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

/* ---------------- XML SAFETY ---------------- */

function escapeXml(unsafe: string) {
  return unsafe
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}
