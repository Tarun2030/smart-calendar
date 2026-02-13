import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------------- SUPABASE ---------------- */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ---------------- TWILIO XML HELPER ---------------- */

function twiml(message: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

/* ---------------- HEALTH CHECK ---------------- */

export async function GET() {
  return twiml('Webhook active');
}

/* ---------------- IST DATE ---------------- */

function getISTDate(offsetDays = 0) {
  const now = new Date();

  const ist = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );

  ist.setDate(ist.getDate() + offsetDays);

  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, '0');
  const day = String(ist.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/* ---------------- GET TODAY EVENTS ---------------- */

async function getTodaysEvents(userId: string) {
  const today = getISTDate(0);

  const { data } = await supabase
    .from('events')
    .select('title,type')
    .eq('user_id', userId)
    .eq('date', today)
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return null;

  return data.map(e => `• ${e.title}`).join('\n');
}

/* ---------------- MAIN WEBHOOK ---------------- */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const lower = body.toLowerCase().trim();

    console.log('Incoming WhatsApp message:', { from, body });

    /* ---------- NORMALIZE PHONE ---------- */

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

    /* ---------- STORE RAW MESSAGE ---------- */

    await supabase.from('activity_logs').insert({
      user_id: userId,
      event_type: 'incoming_whatsapp',
      payload: { from, body },
      status: 'received'
    });

    /* ---------- COMMAND: TODAY ---------- */

    if (lower === 'today' && userId) {
      const list = await getTodaysEvents(userId);

      if (!list)
        return twiml('No events today');

      return twiml(`You have today:\n${list}`);
    }

    /* ---------- DATE PARSER ---------- */

    let eventDate: string | null = null;

    if (lower.includes('today')) eventDate = getISTDate(0);
    if (lower.includes('tomorrow')) eventDate = getISTDate(1);

    /* ---------- TYPE PARSER ---------- */

    let type = 'task';
    if (lower.includes('meeting')) type = 'meeting';
    if (lower.includes('flight')) type = 'flight';
    if (lower.includes('hotel')) type = 'hotel';
    if (lower.includes('deadline')) type = 'deadline';

    /* ---------- CREATE EVENT ---------- */

    let replyText = '';

    if (eventDate && userId) {
      await supabase.from('events').insert({
        user_id: userId,
        type,
        title: body,
        date: eventDate,
        raw_message: body,
        whatsapp_phone: phone
      });

      replyText = `Added ${type} on ${eventDate}`;
    } else {
      replyText = 'Please mention today or tomorrow so I can save it';
    }

    return twiml(replyText);

  } catch (error) {
    console.error('Webhook error:', error);
    return twiml('Server error. Please try again.');
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
