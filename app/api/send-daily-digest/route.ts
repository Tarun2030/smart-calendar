import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActiveUsers, getUpcomingEvents, logActivity } from '@/lib/supabase/queries';
import { generateDailyDigestPDF } from '@/lib/integrations/pdf-generator';
import { sendWhatsAppMessage } from '@/lib/integrations/twilio';
import { sendEmail } from '@/lib/integrations/resend';
import { logger } from '@/lib/utils/logger';
import type { Event } from '@/lib/types/event.types';

export const dynamic = 'force-dynamic';

/* ---------------- SUPABASE (for reminders) ---------------- */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ---------------- IST TIME ---------------- */

function getISTNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

function is7AMIST(): boolean {
  const now = getISTNow();
  return now.getHours() === 7; // digest only at 7AM IST
}

/* ===========================================================
   REMINDER ENGINE (RUNS EVERY CRON INVOCATION)
   =========================================================== */

async function processReminders() {
  const nowISO = new Date().toISOString();

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, date, time, whatsapp_phone')
    .lte('reminder_at', nowISO)
    .eq('reminder_sent', false)
    .not('reminder_at', 'is', null);

  if (error || !events || events.length === 0) return;

  logger.info(`Sending ${events.length} reminders`);

  for (const e of events) {
    try {
      const msg = `Reminder:\n${e.title}\n${e.date} ${e.time ?? ''}`;

      await sendWhatsAppMessage(e.whatsapp_phone, msg);

      await supabase
        .from('events')
        .update({
          reminder_sent: true,
          last_notified_at: new Date().toISOString(),
        })
        .eq('id', e.id);

    } catch (err) {
      logger.error('Reminder failed', { eventId: e.id, err });
    }
  }
}

/* ===========================================================
   MAIN CRON
   =========================================================== */

export async function GET(request: NextRequest) {
  try {
    /* ---------- SECURITY ---------- */
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Cron triggered');

    /* ---------- STEP 1: ALWAYS RUN REMINDERS ---------- */
    await processReminders();

    /* ---------- STEP 2: ONLY RUN DIGEST AT 7AM IST ---------- */
    if (!is7AMIST()) {
      logger.info('Skipping digest (not 7AM IST)');
      return NextResponse.json({ success: true, remindersOnly: true });
    }

    logger.info('Running daily digest');

    const users = await getActiveUsers();
    if (!users?.length) return NextResponse.json({ success: true, processed: 0 });

    const results: any[] = [];

    for (const user of users) {
      try {
        const events = await getUpcomingEvents(user.id, 7);
        if (!events?.length) continue;

        const pdfBuffer = await generateDailyDigestPDF(events, user.name || 'User', {
          from: new Date(),
          to: new Date(Date.now() + 7 * 86400000),
        });

        const summary = generateTextSummary(events);

        if (user.whatsapp_enabled && user.phone_number) {
          await sendWhatsAppMessage(user.phone_number, summary, pdfBuffer);
          await logActivity(user.id, 'digest_sent_whatsapp', { success: true });
        }

        if (user.email_enabled && user.email) {
          await sendEmail({
            to: user.email,
            subject: `Daily Digest - ${new Date().toLocaleDateString('en-IN')}`,
            html: generateEmailHTML(events, user.name || 'User'),
            attachments: [{ filename: 'digest.pdf', content: pdfBuffer }],
          });

          await logActivity(user.id, 'digest_sent_email', { success: true });
        }

        results.push({ userId: user.id, success: true });

      } catch (err) {
        logger.error('Digest failed', { userId: user.id, err });
        results.push({ userId: user.id, success: false });
      }
    }

    return NextResponse.json({ success: true, processed: results.length });

  } catch (error) {
    logger.error('Cron crashed', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ---------------- TEXT SUMMARY ---------------- */

function generateTextSummary(events: Event[]): string {
  const summary = {
    flights: events.filter(e => e.type === 'flight').length,
    hotels: events.filter(e => e.type === 'hotel').length,
    meetings: events.filter(e => e.type === 'meeting').length,
    tasks: events.filter(e => e.type === 'task' && e.status !== 'completed').length,
    deadlines: events.filter(e => e.type === 'deadline').length,
  };

  return `Good Morning!

Flights: ${summary.flights}
Hotels: ${summary.hotels}
Meetings: ${summary.meetings}
Pending Tasks: ${summary.tasks}
Deadlines: ${summary.deadlines}

Detailed PDF attached.`;
}

/* ---------------- EMAIL HTML ---------------- */

function generateEmailHTML(events: Event[], userName: string): string {
  return `<h2>Good Morning ${userName}</h2><p>Your weekly digest is attached.</p>`;
}
