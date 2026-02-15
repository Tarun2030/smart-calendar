import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActiveUsers, getUpcomingEvents, logActivity } from '@/lib/supabase/queries';
import { generateDailyDigestPDF } from '@/lib/integrations/pdf-generator';
import { sendWhatsAppMessage } from '@/lib/integrations/twilio';
import { sendEmail } from '@/lib/integrations/resend';
import { logger } from '@/lib/utils/logger';
import type { Event } from '@/lib/types/event.types';

export const dynamic = 'force-dynamic';

/* ---------------- SUPABASE ---------------- */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ---------------- IST TIME ---------------- */

function getISTNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/* Send digest only at 7 PM IST */
function isDigestTime(): boolean {
  const now = getISTNow();
  return now.getHours() === 19;
}

/* ===========================================================
   MAIN CRON — DAILY DIGEST ONLY
   =========================================================== */

export async function GET(request: NextRequest) {
  try {
    /* ---------- SECURITY ---------- */
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Digest cron triggered');

    /* ---------- RUN ONLY AT 7PM IST ---------- */
    if (!isDigestTime()) {
      logger.info('Skipping digest (not 7PM IST)');
      return NextResponse.json({ success: true, skipped: true });
    }

    logger.info('Running daily digest generation');

    const users = await getActiveUsers();
    if (!users?.length) return NextResponse.json({ success: true, processed: 0 });

    const results: any[] = [];

    for (const user of users) {
      try {
        const events = await getUpcomingEvents(user.id, 7);
        if (!events?.length) continue;

        /* ---------- GENERATE PDF ---------- */
        const pdfBuffer = await generateDailyDigestPDF(events, user.name || 'User', {
          from: new Date(),
          to: new Date(Date.now() + 7 * 86400000),
        });

        const summary = generateTextSummary(events);

        /* ---------- WHATSAPP ---------- */
        if (user.whatsapp_enabled && user.phone_number) {
          await sendWhatsAppMessage(user.phone_number, summary, pdfBuffer);
          await logActivity(user.id, 'digest_sent_whatsapp', { success: true });
        }

        /* ---------- EMAIL ---------- */
        if (user.email_enabled && user.email) {
          await sendEmail({
            to: user.email,
            subject: `Your Upcoming 7 Day Schedule`,
            html: generateEmailHTML(events, user.name || 'User'),
            attachments: [{ filename: 'schedule.pdf', content: pdfBuffer }],
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
    logger.error('Digest cron crashed', { error });
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

  return `Good Evening!

Here is your upcoming 7-day schedule:

Flights: ${summary.flights}
Hotels: ${summary.hotels}
Meetings: ${summary.meetings}
Pending Tasks: ${summary.tasks}
Deadlines: ${summary.deadlines}

Detailed calendar PDF attached.`;
}

/* ---------------- EMAIL HTML ---------------- */

function generateEmailHTML(events: Event[], userName: string): string {
  return `
    <h2>Good Evening ${userName}</h2>
    <p>Your upcoming 7-day calendar is attached as a PDF.</p>
    <p>Please review your schedule and plan accordingly.</p>
  `;
}
