import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { logger } from '@/lib/utils/logger';

/**
 * Get Twilio client instance.
 */
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  return twilio(accountSid, authToken);
}

function getAuthToken() {
  return process.env.TWILIO_AUTH_TOKEN || '';
}

function getWhatsAppNumber() {
  return process.env.TWILIO_WHATSAPP_NUMBER || '';
}

/**
 * Validate that a request is actually from Twilio using HMAC signature.
 */
export async function validateTwilioSignature(request: NextRequest): Promise<boolean> {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('WEBHOOK_SECRET not set, skipping Twilio validation');
      return true; // In development, skip validation if not configured
    }

    const signature = request.headers.get('x-twilio-signature');
    if (!signature) {
      return false;
    }

    const url = request.url;
    const body = await request.clone().formData();
    const params: Record<string, string> = {};
    body.forEach((value, key) => {
      params[key] = value.toString();
    });

    return twilio.validateRequest(getAuthToken(), signature, url, params);
  } catch (error) {
    logger.error('Twilio signature validation error', { error });
    return false;
  }
}

/**
 * Send a WhatsApp message via Twilio.
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string,
  _mediaBuffer?: Buffer
): Promise<string | null> {
  try {
    const client = getTwilioClient();

    const messageOptions: {
      from: string;
      to: string;
      body: string;
      mediaUrl?: string[];
    } = {
      from: getWhatsAppNumber(),
      to: `whatsapp:${to}`,
      body,
    };

    // Note: For media (like PDF), you'd need to host the file
    // and pass the URL. For simplicity, we send text only here.
    // In production, upload the PDF to a storage service and pass the URL.

    const message = await client.messages.create(messageOptions);

    logger.info('WhatsApp message sent', {
      to,
      messageSid: message.sid,
    });

    return message.sid;
  } catch (error) {
    logger.error('Failed to send WhatsApp message', { error, to });
    throw error;
  }
}
