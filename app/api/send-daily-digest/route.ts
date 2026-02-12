import { NextRequest, NextResponse } from 'next/server';
import { getActiveUsers, getUpcomingEvents, logActivity } from '@/lib/supabase/queries';
import { generateDailyDigestPDF } from '@/lib/integrations/pdf-generator';
import { sendWhatsAppMessage } from '@/lib/integrations/twilio';
import { sendEmail } from '@/lib/integrations/resend';
import { logger } from '@/lib/utils/logger';
import type { Event } from '@/lib/types/event.types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Daily digest cron started');

    const users = await getActiveUsers();
    const results: Array<{ userId: string; success: boolean; error?: string }> = [];

    for (const user of users) {
      try {
        // Get events for next 7 days
        const events = await getUpcomingEvents(user.id, 7);

        if (events.length === 0) {
          logger.info('No events for user, skipping', { userId: user.id });
          continue;
        }

        // Generate PDF
        const pdfBuffer = await generateDailyDigestPDF(events, user.name || 'User', {
          from: new Date(),
          to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        // Generate text summary
        const textSummary = generateTextSummary(events);

        // Send via WhatsApp
        if (user.whatsapp_enabled) {
          try {
            await sendWhatsAppMessage(user.phone_number, textSummary, pdfBuffer);
            await logActivity(user.id, 'digest_sent_whatsapp', { success: true });
          } catch (error) {
            logger.error('WhatsApp send failed', { userId: user.id, error });
            await logActivity(user.id, 'digest_sent_whatsapp', {
              success: false,
              error: String(error),
            });
          }
        }

        // Send via Email
        if (user.email_enabled && user.email) {
          try {
            await sendEmail({
              to: user.email,
              subject: `Daily Digest - ${new Date().toLocaleDateString()}`,
              html: generateEmailHTML(events, user.name || 'User'),
              attachments: [
                {
                  filename: `daily-digest-${new Date().toISOString().split('T')[0]}.pdf`,
                  content: pdfBuffer,
                },
              ],
            });
            await logActivity(user.id, 'digest_sent_email', { success: true });
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
        logger.error('Failed to process user digest', { userId: user.id, error });
        results.push({
          userId: user.id,
          success: false,
          error: String(error),
        });
      }
    }

    logger.info('Daily digest cron completed', {
      totalUsers: users.length,
      successful: results.filter((r) => r.success).length,
    });

    return NextResponse.json({
      success: true,
      processed: users.length,
      results,
    });
  } catch (error) {
    logger.error('Daily digest cron failed', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateTextSummary(events: Event[]): string {
  const summary = {
    flights: events.filter((e) => e.type === 'flight').length,
    hotels: events.filter((e) => e.type === 'hotel').length,
    meetings: events.filter((e) => e.type === 'meeting').length,
    tasks: events.filter((e) => e.type === 'task' && e.status !== 'completed').length,
    deadlines: events.filter((e) => e.type === 'deadline').length,
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';

  return `Good Morning! Here's your digest for the next 7 days:

Flights: ${summary.flights}
Hotels: ${summary.hotels}
Meetings: ${summary.meetings}
Pending Tasks: ${summary.tasks}
Deadlines: ${summary.deadlines}

Detailed PDF attached
View Dashboard: ${appUrl}/dashboard

Have a productive day!`;
}

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
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; }
          .stat { display: inline-block; margin: 10px 15px 10px 0; }
          .stat-label { font-size: 14px; color: #6b7280; }
          .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button {
            display: inline-block;
            background: #3B82F6;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">Good Morning, ${userName}!</h1>
            <p style="margin:10px 0 0 0;">Your daily digest for the next 7 days</p>
          </div>
          <div class="content">
            <h2>Quick Summary</h2>
            <div>
              <div class="stat">
                <div class="stat-label">Flights</div>
                <div class="stat-value">${summary.flights}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Hotels</div>
                <div class="stat-value">${summary.hotels}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Meetings</div>
                <div class="stat-value">${summary.meetings}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Tasks</div>
                <div class="stat-value">${summary.tasks}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Deadlines</div>
                <div class="stat-value">${summary.deadlines}</div>
              </div>
            </div>
            <p>Your detailed PDF report is attached to this email.</p>
            <a href="${appUrl}/dashboard" class="button">
              View Dashboard
            </a>
          </div>
          <div class="footer">
            <p>WhatsApp AI Assistant - Your Personal Event Manager</p>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
