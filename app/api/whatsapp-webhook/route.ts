import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health check — required so Next mounts the route
 */
export async function GET() {
  return NextResponse.json({ status: 'alive' });
}

/**
 * Twilio webhook
 */
export async function POST(request: NextRequest) {
  console.log('Webhook received');
  return NextResponse.json({
    status: 'success',
    message: 'Webhook working!',
  });
}
