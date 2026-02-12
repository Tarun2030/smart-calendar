import { Resend } from 'resend';
import { logger } from '@/lib/utils/logger';

function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY || 'placeholder');
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

/**
 * Send an email using Resend.
 */
export async function sendEmail(options: SendEmailOptions): Promise<string | null> {
  try {
    if (!process.env.RESEND_API_KEY) {
      logger.warn('Resend API key not configured, skipping email send');
      return null;
    }

    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: 'WhatsApp AI Assistant <noreply@yourdomain.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
      })),
    });

    if (error) {
      logger.error('Resend email error', { error, to: options.to });
      throw error;
    }

    logger.info('Email sent successfully', { to: options.to, id: data?.id });
    return data?.id || null;
  } catch (error) {
    logger.error('Failed to send email', { error, to: options.to });
    throw error;
  }
}
