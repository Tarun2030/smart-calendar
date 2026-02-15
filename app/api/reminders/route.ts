import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

export const runtime = 'nodejs';

/* ---------------- SUPABASE ---------------- */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ---------------- TWILIO ---------------- */

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FROM = 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER!;

/* ---------------- TIME HELPERS ---------------- */

// convert server UTC -> IST -> back to correct ISO
function getNowISTISOString() {
  const now = new Date();

  const ist = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );

  return new Date(ist.getTime() - ist.getTimezoneOffset() * 60000).toISOString();
}

/* ---------------- FORMAT ---------------- */

function format12h(time: string | null) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = Number(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

/* ---------------- CRON WORKER ---------------- */

export async function GET() {
  try {

    const nowIST = getNowISTISOString();

    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, date, time, whatsapp_phone, reminder_at')
      .eq('reminder_sent', false)
      .not('reminder_at', 'is', null)
      .lte('reminder_at', nowIST)
      .order('reminder_at', { ascending: true })
      .limit(20);

    if (error) throw error;

    if (!events || events.length === 0)
      return NextResponse.json({ status: 'no reminders' });

    let sent = 0;

    for (const e of events) {
      try {

        const message =
`⏰ Reminder

${e.title}
${e.date}${e.time ? ' at ' + format12h(e.time) : ''}`;

        await client.messages.create({
          from: FROM,
          to: `whatsapp:${e.whatsapp_phone}`,
          body: message
        });

        await supabase
          .from('events')
          .update({
            reminder_sent: true,
            last_notified_at: new Date().toISOString()
          })
          .eq('id', e.id);

        sent++;

      } catch (twilioErr) {
        console.error('Twilio failed for event', e.id, twilioErr);
      }
    }

    return NextResponse.json({ sent });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'cron failed' }, { status: 500 });
  }
}
