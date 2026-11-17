import "server-only";
import { createClient } from "@/lib/supabase/server";

export const AVATAR_BUCKET = "patient-avatars";
/** Signed URLs are short-lived; they are generated per request and never cached. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * One batched call to sign every avatar on a page. Returns a map of avatar_path -> URL.
 * Paths the caller may not read (RLS) are simply missing from the map.
 */
export async function signAvatarUrls(
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
  }
  return out;
}

export async function signAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  return (await signAvatarUrls([path]))[path] ?? null;
}

/** Sign avatars for rows that carry an avatar_path; returns id -> url. */
export async function avatarUrlsById(
  rows: { id: string; avatar_path?: string | null }[],
): Promise<Record<string, string>> {
  const byPath = await signAvatarUrls(rows.map((r) => r.avatar_path));
  const out: Record<string, string> = {};
  for (const r of rows) {
    const url = r.avatar_path ? byPath[r.avatar_path] : undefined;
    if (url) out[r.id] = url;
  }
  return out;
}
