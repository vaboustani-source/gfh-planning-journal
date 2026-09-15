import { supabase } from "@/integrations/supabase/client";

/* gfh_resources rows store a "public" storage URL, but the event-documents
   bucket is private, so that URL returns 400. Sign the object path instead.
   Signed links last an hour; pages re-sign on each load. */

const BUCKET = "event-documents";

export function resourceStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const m = fileUrl.match(/\/object\/(?:public|sign|authenticated)\/event-documents\/(.+?)(?:\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function signResourceUrl(fileUrl: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  const path = resourceStoragePath(fileUrl);
  if (!path) return fileUrl ?? null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? fileUrl ?? null;
}

export async function signResourceUrls<T extends { file_url: string | null }>(rows: T[], expiresIn = 3600): Promise<(T & { signedUrl: string | null })[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, signedUrl: await signResourceUrl(r.file_url, expiresIn) })));
}
