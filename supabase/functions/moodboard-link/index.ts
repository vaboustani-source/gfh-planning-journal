// Mood Board: turn a pasted link (Pinterest pin, Instagram post, TikTok, any web page)
// into a saved card. We copy the preview image into the "moodboard" bucket because
// Instagram/TikTok CDN image URLs expire within days.
// Body: { event_id, url, category? } -> { item }
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ADMIN_ROLES = ["admin", "event_director"];
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
// Instagram and Pinterest only serve Open Graph tags to link-preview bots.
const PREVIEW_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

type Provider = "pinterest" | "instagram" | "tiktok" | "web";
type Preview = { title: string | null; image: string | null; finalUrl: string };

function providerFor(url: URL): Provider {
  const h = url.hostname.replace(/^www\./, "");
  if (h === "pin.it" || h.includes("pinterest.")) return "pinterest";
  if (h === "instagram.com" || h === "instagr.am") return "instagram";
  if (h.endsWith("tiktok.com")) return "tiktok";
  return "web";
}

// Only fetch public web pages, never internal addresses.
function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".") && !h.includes(":")) return true;
  if (h.includes(":")) return true; // IPv6 literals
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function meta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

async function openGraph(url: string, ua: string): Promise<Preview | null> {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": ua, "Accept": "text/html,*/*" } });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 600_000);
    const image = meta(html, "og:image") ?? meta(html, "twitter:image") ?? meta(html, "og:image:url");
    const title = meta(html, "og:title") ?? meta(html, "twitter:title") ??
      (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null);
    return { title: title ? decodeEntities(title) : null, image: image ? new URL(image, res.url).toString() : null, finalUrl: res.url };
  } catch {
    return null;
  }
}

async function tiktokOembed(url: string): Promise<Preview | null> {
  try {
    const res = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": BROWSER_UA },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const title = [d.title, d.author_name ? `@${d.author_unique_id ?? d.author_name}` : null].filter(Boolean).join(" · ");
    return { title: title || null, image: d.thumbnail_url ?? null, finalUrl: url };
  } catch {
    return null;
  }
}

// Instagram's public embed page still carries the post image when the post page itself
// shows a login wall to servers.
async function instagramEmbed(url: URL): Promise<Preview | null> {
  const m = url.pathname.match(/^\/(?:[^/]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const postUrl = `https://www.instagram.com/${m[1]}/${m[2]}/`;
  try {
    const res = await fetchWithTimeout(`${postUrl}embed/captioned/`, { headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) return null;
    const html = await res.text();
    const img = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/)?.[1] ??
      html.match(/<img[^>]+src="([^"]+)"[^>]*class="EmbeddedMediaImage"/)?.[1] ?? null;
    const user = html.match(/class="UsernameText"[^>]*>([^<]+)</)?.[1] ?? null;
    return { title: user ? `@${decodeEntities(user)} on Instagram` : null, image: img ? decodeEntities(img) : null, finalUrl: postUrl };
  } catch {
    return null;
  }
}

async function preview(url: URL, provider: Provider): Promise<Preview> {
  const u = url.toString();
  const attempts: (() => Promise<Preview | null>)[] = [];
  if (provider === "tiktok") attempts.push(() => tiktokOembed(u));
  if (provider === "instagram") attempts.push(() => instagramEmbed(url));
  if (provider !== "tiktok") attempts.push(() => openGraph(u, PREVIEW_UA));
  attempts.push(() => openGraph(u, BROWSER_UA));
  // First attempt with an image wins; otherwise keep the first one that found anything.
  let best: Preview | null = null;
  for (const attempt of attempts) {
    const p = await attempt();
    if (p?.image) return { ...p, title: p.title ?? best?.title ?? null };
    best = best ?? p;
  }
  return best ?? { title: null, image: null, finalUrl: u };
}

async function copyImage(admin: SupabaseClient, eventId: string, imageUrl: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(imageUrl, { headers: { "User-Agent": BROWSER_UA, "Accept": "image/*" } }, 15000);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!type.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    const ext = ({ "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" } as Record<string, string>)[type] ?? "jpg";
    const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage.from("moodboard").upload(path, buf, { contentType: type, upsert: false });
    return error ? null : path;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Please sign in again." }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);

    const { event_id, url: rawUrl, category } = await req.json().catch(() => ({}));
    if (!event_id || typeof rawUrl !== "string" || !rawUrl.trim()) return json({ error: "Paste a link first." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = ADMIN_ROLES.includes(profile?.role ?? "");
    if (!isAdmin) {
      const { data: member } = await admin.from("event_users").select("id")
        .eq("event_id", event_id).eq("user_id", user.id).maybeSingle();
      if (!member) return json({ error: "You don't have access to this wedding." }, 403);
    }

    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`);
    } catch {
      return json({ error: "That doesn't look like a link." }, 400);
    }
    if (!["http:", "https:"].includes(url.protocol) || isPrivateHost(url.hostname)) {
      return json({ error: "That doesn't look like a link." }, 400);
    }

    let provider = providerFor(url);
    const p = await preview(url, provider);
    // pin.it short links resolve to pinterest.com; keep the real post URL.
    let finalUrl = p.finalUrl;
    try {
      const f = new URL(finalUrl);
      if (providerFor(f) !== "web") provider = providerFor(f);
      if (f.hostname.includes("pinterest.") && f.pathname.startsWith("/pin/")) finalUrl = `https://www.pinterest.com${f.pathname}`;
    } catch { finalUrl = url.toString(); }

    const imagePath = p.image ? await copyImage(admin, event_id, p.image) : null;
    const genericTitles = /^(instagram|tiktok|pinterest)$|^(tiktok - make your day)$/i;
    const title = p.title && !genericTitles.test(p.title.trim()) ? p.title.trim().slice(0, 300) : null;

    const { data: item, error } = await admin.from("moodboard_items").insert({
      event_id,
      kind: "link",
      provider,
      source_url: finalUrl,
      image_path: imagePath,
      title,
      category: typeof category === "string" && category ? category : "other",
      created_by: user.id,
    }).select("*").single();
    if (error) throw error;

    return json({ item, image_found: !!imagePath });
  } catch (err) {
    console.error("moodboard-link error:", err);
    return json({ error: (err as Error).message ?? "Something went wrong" }, 500);
  }
});
