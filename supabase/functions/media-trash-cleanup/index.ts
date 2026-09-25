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
  const { data: rows, error } = await db
    .from("gallery_items")
    .select("id,storage_path,caption,uploader_id,deleted_at")
    .not("deleted_at", "is", null)
    .lte("deleted_at", cutoff)
    .order("deleted_at", { ascending: true })
    .limit(250);

  if (error) {
    console.error("trash query failed", error);
    return Response.json({ error: "trash query failed" }, { status: 500 });
  }

  const items = rows || [];
  if (!items.length) return Response.json({ ok: true, removed: 0 });

  const paths = items.map((x: any) => x.storage_path).filter(Boolean);
  const { error: storageError } = await db.storage.from("crew-media").remove(paths);
  if (storageError) {
    console.error("storage cleanup failed", storageError);
    return Response.json({ error: "storage cleanup failed" }, { status: 500 });
  }

  const ids = items.map((x: any) => x.id);
  const { error: deleteError } = await db.from("gallery_items").delete().in("id", ids);
  if (deleteError) {
    console.error("row cleanup failed", deleteError);
    return Response.json({ error: "row cleanup failed" }, { status: 500 });
  }

  const auditRows = items.map((x: any) => ({
    actor_id: null,
    action: "gallery_auto_purge",
    entity_type: "gallery_item",
    entity_id: String(x.id),
    details: {
      uploader_id: x.uploader_id,
      caption: x.caption,
      storage_path: x.storage_path,
      deleted_at: x.deleted_at
    }
  }));
  if (auditRows.length) await db.from("audit_log").insert(auditRows);

  return Response.json({ ok: true, removed: ids.length });
});
