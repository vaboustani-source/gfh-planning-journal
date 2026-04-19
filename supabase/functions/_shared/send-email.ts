/**
 * Shared email helper for Supabase Edge Functions.
 * Sends branded notification emails through Resend.
 *
 * Required secret: RESEND_API_KEY must be configured in Edge Functions secrets.
 */

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface ResendEmailResponse {
  id: string;
  object: string;
}

interface ResendErrorResponse {
  message: string;
  statusCode: number;
}

/**
 * Strip HTML tags and decode basic entities to create a plain-text version.
 */
export function stripHtml(html: string): string {
  // Remove script and style tags and their contents
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Replace common block-level tags with newlines
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode basic HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&hellip;/g, '...');
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');

  // Collapse multiple whitespace/newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Send a branded email through Resend.
 * Throws if RESEND_API_KEY is not configured or if the API call fails.
 */
export async function sendEmail(params: SendEmailParams): Promise<ResendEmailResponse> {
  const { to, subject, html, text, replyTo } = params;

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured in Edge Functions secrets');
  }

  // Generate plain text fallback if not provided
  const plainText = text ?? stripHtml(html);

  // Default reply-to address
  const defaultReplyTo = 'experience@gilbertsvillefarmhouse.com';

  const payload = {
    from: 'Gilbertsville Farmhouse <noreply@plan.gilbertsvillefarmhouse.com>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: plainText,
    reply_to: replyTo ?? defaultReplyTo,
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Unknown error' })) as ResendErrorResponse;
    throw new Error(`Resend API error (${response.status}): ${errorBody.message}`);
  }

  const result = await response.json() as ResendEmailResponse;
  return result;
}
