import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { status: "Webhook reached successfully" },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook is active' });
}
