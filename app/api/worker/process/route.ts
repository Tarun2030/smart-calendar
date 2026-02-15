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

/* 7:00 PM IST = 13:30 UTC */
function isDigestTime(): boolean {
  const now = new Date()
  return now.getUTCHours() === 13 && now.getUTCMinutes() >= 30 && now.getUTCMinutes() <= 40
}

export async function GET() {
  let job: any = null

  try {

    /* STEP 1 — CLAIM JOB */
    const { data, error } = await supabase.rpc('get_next_cron_job')

    if (error) {
      console.error(error)
      return NextResponse.json({ status: 'rpc_error', error })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ status: 'no_jobs' })
    }

    /* CRITICAL FIX — EXTRACT FIRST ROW */
    job = data[0]

    console.log("CLAIMED JOB:", job)

    if (job.job_type !== 'daily_digest') {
      await supabase.rpc('fail_cron_job', {
        job_id: job.id,
        job_error: `unknown_job_${job.job_type}`
      })
      return NextResponse.json({ status: 'unknown_job', received: job })
    }

    /* STEP 2 — TIME CHECK */
    if (!isDigestTime()) {
      await supabase.rpc('complete_cron_job', {
        job_id: job.id,
        job_result: { skipped: true, reason: 'not_7pm_IST' }
      })
      return NextResponse.json({ status: 'skipped_time_window' })
    }

    /* STEP 3 — RUN DIGEST */
    const users = await getActiveUsers()

    if (!users || users.length === 0) {
      await supabase.rpc('complete_cron_job', {
        job_id: job.id,
        job_result: { processed: 0, reason: 'no_users' }
      })
      return NextResponse.json({ status: 'no_users' })
    }

    let processed = 0

    for (const user of users) {
      try {
        const events: Event[] = await getUpcomingEvents(user.id, 7)
        if (!events?.length) continue

        const pdf = await generateDailyDigestPDF(events, user.name || 'User', {
          from: new Date(),
          to: new Date(Date.now() + 7 * 86400000),
        })

        const message = `Your upcoming 7-day calendar is attached.`

        if (user.whatsapp_enabled && user.phone_number) {
          await sendWhatsAppMessage(user.phone_number, message, pdf)
          await logActivity(user.id, 'digest_sent_whatsapp', { success: true })
        }

        if (user.email_enabled && user.email) {
          await sendEmail({
            to: user.email,
            subject: 'Your Upcoming 7-Day Schedule',
            html: '<p>Your schedule PDF is attached.</p>',
            attachments: [{ filename: 'schedule.pdf', content: pdf }],
          })
          await logActivity(user.id, 'digest_sent_email', { success: true })
        }

        processed++
      } catch (err) {
        console.error('USER FAILED:', user.id, err)
      }
    }

    /* STEP 4 — SUCCESS */
    await supabase.rpc('complete_cron_job', {
      job_id: job.id,
      job_result: { processed }
    })

    return NextResponse.json({ status: 'completed', processed })

  } catch (err: any) {

    console.error('WORKER CRASH:', err)

    if (job?.id) {
      await supabase.rpc('fail_cron_job', {
        job_id: job.id,
        job_error: err?.message || 'worker_crash'
      })
    }

    return NextResponse.json({ status: 'worker_failed' }, { status: 500 })
  }
}
