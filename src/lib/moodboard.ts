import { supabase } from "@/integrations/supabase/client";

export const MOODBOARD_CATEGORIES: { key: string; label: string }[] = [
  { key: "florals", label: "Florals" },
  { key: "tablescape", label: "Tablescapes" },
  { key: "ceremony", label: "Ceremony" },
  { key: "reception", label: "Reception" },
  { key: "lighting", label: "Lighting" },
  { key: "cake", label: "Cake & Desserts" },
  { key: "attire", label: "Attire & Beauty" },
  { key: "paper", label: "Stationery & Signage" },
  { key: "palette", label: "Colors & Palette" },
  { key: "other", label: "Other" },
];

export const categoryLabel = (key: string) =>
  MOODBOARD_CATEGORIES.find(c => c.key === key)?.label ?? "Other";

export const PROVIDER_LABELS: Record<string, string> = {
  upload: "Photo",
  pinterest: "Pinterest",
  instagram: "Instagram",
  tiktok: "TikTok",
  web: "Link",
};

export type MoodboardItem = {
  id: string;
  event_id?: string;
  kind: string;
  provider: string;
  image_path: string | null;
  source_url: string | null;
  title: string | null;
  category: string;
  note: string | null;
  staff_note?: string | null;
  approved: boolean;
  created_at?: string;
};

export const moodboardImageUrl = (path: string | null) =>
  path ? supabase.storage.from("moodboard").getPublicUrl(path).data.publicUrl : null;

/** A Pinterest board link looks like pinterest.com/<user>/<board>/ (not a /pin/ link). */
export function normalizePinterestBoard(raw: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    if (!/(^|\.)pinterest\.[a-z.]+$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || ["pin", "search", "ideas", "today"].includes(parts[0])) return null;
    return `https://www.pinterest.com/${parts[0]}/${parts[1]}/`;
  } catch {
    return null;
  }
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function isImageFile(f: File) {
  return f.type.startsWith("image/") || IMAGE_EXT.test(f.name);
}

/** Upload one image into <event_id>/ in the moodboard bucket; returns the storage path. */
export async function uploadMoodboardImage(eventId: string, file: File): Promise<string> {
  const ext = (file.name.match(IMAGE_EXT)?.[1] ?? file.type.split("/")[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
  const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("moodboard").upload(path, file, {
    contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
    upsert: false,
  });
  if (error) throw error;
  return path;
}
