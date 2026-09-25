import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { data: cfgRows, error: cfgError } = await db.rpc("get_push_config");
  const cfg = Array.isArray(cfgRows) ? cfgRows[0] : cfgRows;
  if (cfgError || !cfg?.cron_secret) {
    console.error("cron config unavailable", cfgError);
    return Response.json({ error: "cron configuration unavailable" }, { status: 500 });
  }
  if ((req.headers.get("x-4w1f-cron") || "") !== cfg.cron_secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [galleryResult, primaryResult] = await Promise.all([
    db.from("gallery_items")
      .select("id,storage_path,caption,uploader_id,deleted_at")
      .not("deleted_at", "is", null)
      .lte("deleted_at", cutoff)
      .order("deleted_at", { ascending: true })
      .limit(250),
    db.from("profile_media_trash")
      .select("id,owner_id,media_type,bucket,storage_path,deleted_at")
      .lte("deleted_at", cutoff)
      .order("deleted_at", { ascending: true })
      .limit(250)
  ]);

  if (galleryResult.error || primaryResult.error) {
    console.error("trash query failed", galleryResult.error || primaryResult.error);
    return Response.json({ error: "trash query failed" }, { status: 500 });
  }

  const gallery = galleryResult.data || [];
  const primary = primaryResult.data || [];
  if (!gallery.length && !primary.length) return Response.json({ ok: true, removed: 0 });

  const byBucket = new Map<string, string[]>();
  const addPath = (bucket: string, path: string) => {
    const list = byBucket.get(bucket) || [];
    list.push(path);
    byBucket.set(bucket, list);
  };
  for (const row of gallery) if (row.storage_path) addPath("crew-media", row.storage_path);
  for (const row of primary) if (row.storage_path) addPath(row.bucket, row.storage_path);

  for (const [bucket, paths] of byBucket.entries()) {
    const { error } = await db.storage.from(bucket).remove([...new Set(paths)]);
    if (error) {
      console.error("storage cleanup failed", bucket, error);
      return Response.json({ error: "storage cleanup failed", bucket }, { status: 500 });
    }
  }

  if (gallery.length) {
    const { error } = await db.from("gallery_items").delete().in("id", gallery.map((x: any) => x.id));
    if (error) return Response.json({ error: "gallery row cleanup failed" }, { status: 500 });
  }
  if (primary.length) {
    const { error } = await db.from("profile_media_trash").delete().in("id", primary.map((x: any) => x.id));
    if (error) return Response.json({ error: "primary media row cleanup failed" }, { status: 500 });
  }

  const auditRows = [
    ...gallery.map((x: any) => ({
      actor_id: null,
      action: "gallery_auto_purge",
      entity_type: "gallery_item",
      entity_id: String(x.id),
      details: { uploader_id: x.uploader_id, caption: x.caption, storage_path: x.storage_path, deleted_at: x.deleted_at }
    })),
    ...primary.map((x: any) => ({
      actor_id: null,
      action: "profile_media_auto_purge",
      entity_type: "profile_media",
      entity_id: String(x.id),
      details: { owner_id: x.owner_id, media_type: x.media_type, bucket: x.bucket, storage_path: x.storage_path, deleted_at: x.deleted_at }
    }))
  ];
  if (auditRows.length) await db.from("audit_log").insert(auditRows);

  return Response.json({ ok: true, removed: gallery.length + primary.length });
});
