import { NextRequest, NextResponse } from 'next/server';
import { getActiveUsers, getUpcomingEvents, logActivity } from '@/lib/supabase/queries';
import { generateDailyDigestPDF } from '@/lib/integrations/pdf-generator';
import { sendWhatsAppMessage } from '@/lib/integrations/twilio';
import { sendEmail } from '@/lib/integrations/resend';
import { logger } from '@/lib/utils/logger';
import type { Event } from '@/lib/types/event.types';

export const dynamic = 'force-dynamic';

/* ---------------- IST DATE UTILS ---------------- */

function getISTNow(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
}

function getISTDatePlusDays(days: number): Date {
  const base = getISTNow();
  base.setDate(base.getDate() + days);
  return base;
}

/* ---------------- MAIN CRON ---------------- */

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized digest attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Daily digest cron started');

    const users = await getActiveUsers();
    if (!users || users.length === 0) {
      logger.info('No active users found');
      return NextResponse.json({ success: true, processed: 0 });
    }

    const results: Array<{ userId: string; success: boolean; error?: string }> = [];

    for (const user of users) {
      try {
        const fromDate = getISTNow();
        const toDate = getISTDatePlusDays(7);

        const events = await getUpcomingEvents(user.id, 7);
        if (!events || events.length === 0) {
          logger.info('No upcoming events for user', { userId: user.id });
          continue;
        }

        const pdfBuffer = await generateDailyDigestPDF(
          events,
          user.name || 'User',
          { from: fromDate, to: toDate }
        );

        const textSummary = generateTextSummary(events);

        /* ---------- WHATSAPP ---------- */

        if (user.whatsapp_enabled && user.phone_number) {
          try {
            await sendWhatsAppMessage(user.phone_number, textSummary, pdfBuffer);
            await logActivity(user.id, 'digest_sent_whatsapp', {
              success: true,
              eventCount: events.length,
            });
          } catch (error) {
            logger.error('WhatsApp send failed', { userId: user.id, error });
            await logActivity(user.id, 'digest_sent_whatsapp', {
              success: false,
              error: String(error),
            });
          }
        }

        /* ---------- EMAIL ---------- */

        if (user.email_enabled && user.email) {
          try {
            await sendEmail({
              to: user.email,
              subject: `Weekly Digest - ${fromDate.toLocaleDateString('en-IN')}`,
              html: generateEmailHTML(events, user.name || 'User'),
              attachments: [
                {
                  filename: `weekly-digest-${fromDate.toISOString().split('T')[0]}.pdf`,
                  content: pdfBuffer,
                },
              ],
            });

            await logActivity(user.id, 'digest_sent_email', {
              success: true,
              eventCount: events.length,
            });

          } catch (error) {
            logger.error('Email send failed', { userId: user.id, error });
            await logActivity(user.id, 'digest_sent_email', {
              success: false,
              error: String(error),
            });
          }
        }

        results.push({ userId: user.id, success: true });

      } catch (error) {
        logger.error('Failed processing user digest', { userId: user.id, error });
        results.push({ userId: user.id, success: false, error: String(error) });
      }
    }

    logger.info('Daily digest completed', {
      totalUsers: users.length,
      successful: results.filter((r) => r.success).length,
    });

    return NextResponse.json({ success: true, processed: users.length, results });

  } catch (error) {
    logger.error('Daily digest cron crashed', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ---------------- TEXT SUMMARY ---------------- */

function generateTextSummary(events: Event[]): string {
  const summary = {
    flights: events.filter((e) => e.type === 'flight').length,
    hotels: events.filter((e) => e.type === 'hotel').length,
    meetings: events.filter((e) => e.type === 'meeting').length,
    tasks: events.filter((e) => e.type === 'task' && e.status !== 'completed').length,
    deadlines: events.filter((e) => e.type === 'deadline').length,
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';

  return `Good Morning!

Your next 7-day snapshot:

✈ Flights: ${summary.flights}
🏨 Hotels: ${summary.hotels}
📅 Meetings: ${summary.meetings}
📝 Pending Tasks: ${summary.tasks}
⏰ Deadlines: ${summary.deadlines}

Detailed PDF attached.

Dashboard:
${appUrl}/dashboard

Have a productive day.`;
}

/* ---------------- EMAIL HTML ---------------- */

function generateEmailHTML(events: Event[], userName: string): string {
  const summary = {
    flights: events.filter((e) => e.type === 'flight').length,
    hotels: events.filter((e) => e.type === 'hotel').length,
    meetings: events.filter((e) => e.type === 'meeting').length,
    tasks: events.filter((e) => e.type === 'task' && e.status !== 'completed').length,
    deadlines: events.filter((e) => e.type === 'deadline').length,
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';

  return `
  <!DOCTYPE html>
  <html>
    <body style="font-family: Arial, sans-serif; background:#f5f7fb; padding:20px;">
      <div style="max-width:600px; margin:0 auto; background:white; border-radius:8px; overflow:hidden;">
        <div style="background:#2563eb; color:white; padding:20px;">
          <h2 style="margin:0;">Good Morning, ${userName}</h2>
          <p style="margin:5px 0 0 0;">Your weekly digest</p>
        </div>

        <div style="padding:20px;">
          <h3>Next 7 Days Overview</h3>
          <ul style="line-height:1.8;">
            <li><strong>Flights:</strong> ${summary.flights}</li>
            <li><strong>Hotels:</strong> ${summary.hotels}</li>
            <li><strong>Meetings:</strong> ${summary.meetings}</li>
            <li><strong>Tasks:</strong> ${summary.tasks}</li>
            <li><strong>Deadlines:</strong> ${summary.deadlines}</li>
          </ul>

          <p>Detailed PDF report is attached.</p>

          <a href="${appUrl}/dashboard"
             style="display:inline-block;margin-top:15px;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
            View Dashboard
          </a>
        </div>

        <div style="text-align:center; padding:15px; font-size:12px; color:#6b7280;">
          Generated on ${new Date().toLocaleDateString('en-IN')}
        </div>
      </div>
    </body>
  </html>
  `;
}
