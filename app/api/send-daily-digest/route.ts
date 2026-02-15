import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

/* Trigger only at 7 PM IST */
function isDigestTime(): boolean {
  const now = getISTNow();
  return now.getHours() === 19;
}

/* ===========================================================
   CRON TRIGGER (LIGHTWEIGHT — NEVER SEND PDF HERE)
   =========================================================== */

export async function GET(request: NextRequest) {
  try {

    /* ---------- SECURITY ---------- */
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    /* ---------- RUN ONLY AT 7PM IST ---------- */
    if (!isDigestTime()) {
      return NextResponse.json({ skipped: true });
    }

    /* ------------------------------------------------
       Instead of sending messages, just create a job
       ------------------------------------------------ */

    const { error } = await supabase
      .from('cron_jobs')
      .insert({
        job_type: 'daily_digest',
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    /* Instant response so cron NEVER fails */
    return NextResponse.json({ queued: true });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
