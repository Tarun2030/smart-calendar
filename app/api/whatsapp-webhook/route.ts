import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health check
 * Visiting in browser should show: alive
 */
export async function GET() {
  return new NextResponse('alive', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * Twilio WhatsApp webhook
 * Must return TwiML XML — not JSON
 */
export async function POST(request: NextRequest) {
  try {
    // Twilio sends application/x-www-form-urlencoded
    const formData = await request.formData();

    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';

    console.log('Incoming WhatsApp message:', { from, body });

    // Simple reply (we will replace with AI later)
    const replyText = `Received: ${body}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${escapeXml(replyText)}</Message>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });

  } catch (error) {
    console.error('Webhook error:', error);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Server error. Please try again.</Message>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

/**
 * Prevent XML breaking if user sends special chars
 */
function escapeXml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
