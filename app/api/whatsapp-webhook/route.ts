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

/* ---------------- MAIN WEBHOOK ---------------- */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';

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

    /* ---------- BASIC EVENT PARSER ---------- */

    let replyText = 'Saved.';
    const lower = body.toLowerCase();

    let eventDate: string | null = null;

    if (lower.includes('tomorrow')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      eventDate = d.toISOString().split('T')[0];
    }

    if (lower.includes('today')) {
      const d = new Date();
      eventDate = d.toISOString().split('T')[0];
    }

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
        raw_message: body,
        whatsapp_phone: phone
      });

      replyText = `Added ${type} on ${eventDate}`;
    } else {
      replyText = 'Tell me date (today / tomorrow) to save event';
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
