// Shared Gmail helpers for edge functions.
// Token refresh + message fetch + parsing.

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";

export interface ParsedMessage {
  id: string;
  threadId: string;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string | null;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  has_attachments: boolean;
  attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId: string }>;
  received_at: string | null;
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Gmail OAuth credentials not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function gmailApi(accessToken: string, path: string): Promise<any> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

function decodeBase64Url(data: string): string {
  try {
    const padded = data.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function parseAddress(header: string | null): { name: string | null; address: string | null } {
  if (!header) return { name: null, address: null };
  const m = header.match(/^\s*(?:"?([^"<]+?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || "").trim() || null, address: m[2].trim() };
  return { name: null, address: header.trim() };
}

export function parseGmailMessage(msg: any): ParsedMessage {
  const headers: Record<string, string> = {};
  for (const h of msg.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value;

  const from = parseAddress(headers["from"]);
  const subject = headers["subject"] ?? null;
  const to = headers["to"] ?? null;
  const dateHeader = headers["date"] ?? null;

  let bodyText = "";
  let bodyHtml = "";
  const attachments: ParsedMessage["attachments"] = [];

  const walk = (part: any) => {
    if (!part) return;
    const mime = part.mimeType || "";
    const filename = part.filename;
    if (filename && part.body?.attachmentId) {
      attachments.push({
        filename,
        mimeType: mime,
        size: part.body.size ?? 0,
        attachmentId: part.body.attachmentId,
      });
    } else if (mime === "text/plain" && part.body?.data) {
      bodyText += decodeBase64Url(part.body.data);
    } else if (mime === "text/html" && part.body?.data) {
      bodyHtml += decodeBase64Url(part.body.data);
    }
    for (const p of part.parts ?? []) walk(p);
  };
  walk(msg.payload);

  // Some messages put data directly on payload.body
  if (!bodyText && !bodyHtml && msg.payload?.body?.data) {
    const decoded = decodeBase64Url(msg.payload.body.data);
    if ((msg.payload.mimeType || "").includes("html")) bodyHtml = decoded;
    else bodyText = decoded;
  }

  const receivedAt = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : dateHeader
    ? new Date(dateHeader).toISOString()
    : null;

  return {
    id: msg.id,
    threadId: msg.threadId,
    from_address: from.address,
    from_name: from.name,
    to_addresses: to,
    subject,
    snippet: msg.snippet ?? null,
    body_text: bodyText || null,
    body_html: bodyHtml || null,
    has_attachments: attachments.length > 0,
    attachments,
    received_at: receivedAt,
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
