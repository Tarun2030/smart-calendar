import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveUsers, getUpcomingEvents, logActivity } from '@/lib/supabase/queries'
import { generateDailyDigestPDF } from '@/lib/integrations/pdf-generator'
import { sendWhatsAppMessage } from '@/lib/integrations/twilio'
import { sendEmail } from '@/lib/integrations/resend'
import type { Event } from '@/lib/types/event.types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ---------- IST ---------- */

function getISTNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
}

function isDigestTime(): boolean {
  return getISTNow().getHours() === 19
}

/* ========================================================= */

export async function GET() {
  try {

    /* STEP 1 — FETCH JOB */
    const { data: job, error } = await supabase.rpc('get_next_cron_job')

    if (error || !job) {
      return NextResponse.json({ status: 'no_job' })
    }

    if (job.job_type !== 'daily_digest') {
      await supabase.rpc('fail_cron_job', {
        job_id: job.id,
        job_error: 'Unknown job type'
      })
      return NextResponse.json({ status: 'unknown_job' })
    }

    /* STEP 2 — TIME CHECK */
    if (!isDigestTime()) {
      await supabase.rpc('complete_cron_job', {
        job_id: job.id,
        job_result: { skipped: true, reason: 'not_digest_time' }
      })
      return NextResponse.json({ skipped: true })
    }

    /* STEP 3 — RUN DIGEST */
    const users = await getActiveUsers()
    let processed = 0

    for (const user of users) {
      const events: Event[] = await getUpcomingEvents(user.id, 7)
      if (!events?.length) continue

      const pdf = await generateDailyDigestPDF(events, user.name || 'User', {
        from: new Date(),
        to: new Date(Date.now() + 7 * 86400000),
      })

      const summary = `Your 7-day calendar is attached.`

      if (user.whatsapp_enabled && user.phone_number) {
        await sendWhatsAppMessage(user.phone_number, summary, pdf)
        await logActivity(user.id, 'digest_sent_whatsapp', { success: true })
      }

      if (user.email_enabled && user.email) {
        await sendEmail({
          to: user.email,
          subject: 'Your Upcoming Schedule',
          html: '<p>Your schedule PDF is attached.</p>',
          attachments: [{ filename: 'schedule.pdf', content: pdf }],
        })
        await logActivity(user.id, 'digest_sent_email', { success: true })
      }

      processed++
    }

    /* STEP 4 — MARK SUCCESS */
    await supabase.rpc('complete_cron_job', {
      job_id: job.id,
      job_result: { processed }
    })

    return NextResponse.json({ success: true, processed })

  } catch (err: any) {

    /* STEP 5 — MARK FAILURE */
    await supabase.rpc('fail_cron_job', {
      job_id: null,
      job_error: err?.message || 'worker_crash'
    })

    return NextResponse.json({ error: 'worker_failed' }, { status: 500 })
  }
}
