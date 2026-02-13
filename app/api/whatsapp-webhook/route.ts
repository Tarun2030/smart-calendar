export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('Webhook received!');
  return NextResponse.json({
    status: 'success',
    message: 'Webhook working!'
  });
}
