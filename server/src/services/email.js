import { Resend } from 'resend';
import { z } from 'zod';
import { env } from '../config/env.js';

const recipientSchema = z.string().email();
const subjectSchema = z.string().min(1).max(200).refine((subject) => !/[\r\n]/.test(subject));
const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export async function sendEmail({ to, subject, html }) {
  if (!resend || !env.resendFromEmail) {
    console.info('Email delivery skipped: configure RESEND_API_KEY and RESEND_FROM_EMAIL to enable it.');
    return { sent: false, reason: 'not_configured' };
  }
  if (!recipientSchema.safeParse(to).success || !subjectSchema.safeParse(subject).success || html.length > 20000) {
    console.warn('Email delivery skipped: invalid recipient or message payload.');
    return { sent: false, reason: 'invalid_payload' };
  }

  try {
    const response = await resend.emails.send({
      from: env.resendFromEmail,
      to,
      subject,
      html
    });
    if (response.error) {
      console.error('Resend delivery failed.', {
        name: response.error.name,
        statusCode: response.error.statusCode
      });
      return { sent: false, reason: 'provider_error' };
    }
    console.info('Resend email accepted for delivery.', { id: response.data?.id });
    return { sent: true, id: response.data?.id };
  } catch (error) {
    console.error('Resend delivery failed.', {
      name: error.name,
      message: error.message
    });
    return { sent: false, reason: 'provider_error' };
  }
}

export function emailLayout(title, body) {
  const escapeHtml = (text) => text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <tr>
        <td style="padding:24px 32px;background:#0f172a;color:#ffffff">
          <p style="margin:0;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#7dd3fc">CampusConnect</p>
          <p style="margin:8px 0 0;font-size:14px;color:#cbd5e1">Your campus career network</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#0f172a">${escapeHtml(title)}</h1>
          <p style="margin:0;font-size:16px;line-height:1.7;color:#334155">${escapeHtml(body)}</p>
          <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#64748b">Sign in to CampusConnect to view the latest details and manage your opportunities.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 32px;border-top:1px solid #e2e8f0;background:#f8fafc">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b">This is an automated message from CampusConnect. Please do not reply to this email.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
