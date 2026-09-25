-- 4W1F 3.4.0 backend preparation
-- Apply only during the 3.4.0 production release.

alter table public.gallery_items
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text not null default '';

create index if not exists gallery_items_deleted_at_idx on public.gallery_items(deleted_at);
create index if not exists gallery_items_uploader_deleted_idx on public.gallery_items(uploader_id,deleted_at);

alter table public.profiles
  add column if not exists privacy jsonb not null default
  '{"instagram":true,"vehicle":true,"power":true,"mods":true,"photos":true}'::jsonb;

create table if not exists public.profile_media_trash (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('avatar','vehicle')),
  bucket text not null check (bucket in ('avatars','crew-media')),
  storage_path text not null,
  deleted_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz not null default now(),
  unique(owner_id,media_type,storage_path)
);
create index if not exists profile_media_trash_owner_idx on public.profile_media_trash(owner_id,deleted_at);
create index if not exists profile_media_trash_deleted_idx on public.profile_media_trash(deleted_at);

alter table public.profile_media_trash enable row level security;
drop policy if exists profile_media_trash_read on public.profile_media_trash;
create policy profile_media_trash_read on public.profile_media_trash
for select to authenticated
using (owner_id=(select auth.uid()) or private.is_admin());
grant select on public.profile_media_trash to authenticated;

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notification_sound text not null default 'engine_start',
  support_sound text not null default 'dispatch',
  sound_enabled boolean not null default true,
  support_sound_enabled boolean not null default true,
  first_home_seen_at timestamptz,
  last_home_seen_at timestamptz,
  last_gallery_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
drop policy if exists user_preferences_read_own on public.user_preferences;
create policy user_preferences_read_own on public.user_preferences
for select to authenticated
using (user_id=(select auth.uid()));
drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own on public.user_preferences
for insert to authenticated
with check (user_id=(select auth.uid()));
drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_4w1f_updated_at();

create table if not exists public.crew_places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  address text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  icon text not null default '📍',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crew_places enable row level security;
drop policy if exists crew_places_read on public.crew_places;
create policy crew_places_read on public.crew_places
for select to authenticated using (private.can_access_app());
drop policy if exists crew_places_insert on public.crew_places;
create policy crew_places_insert on public.crew_places
for insert to authenticated with check (private.is_admin());
drop policy if exists crew_places_update on public.crew_places;
create policy crew_places_update on public.crew_places
for update to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists crew_places_delete on public.crew_places;
create policy crew_places_delete on public.crew_places
for delete to authenticated using (private.is_admin());

drop trigger if exists crew_places_updated_at on public.crew_places;
create trigger crew_places_updated_at
before update on public.crew_places
for each row execute function public.set_4w1f_updated_at();

create table if not exists public.app_notification_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key(user_id,notification_key)
);
create index if not exists app_notification_reads_user_idx on public.app_notification_reads(user_id);

alter table public.app_notification_reads enable row level security;
drop policy if exists app_notification_reads_read_own on public.app_notification_reads;
create policy app_notification_reads_read_own on public.app_notification_reads
for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists app_notification_reads_insert_own on public.app_notification_reads;
create policy app_notification_reads_insert_own on public.app_notification_reads
for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists app_notification_reads_update_own on public.app_notification_reads;
create policy app_notification_reads_update_own on public.app_notification_reads
for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists app_notification_reads_delete_own on public.app_notification_reads;
create policy app_notification_reads_delete_own on public.app_notification_reads
for delete to authenticated using (user_id=(select auth.uid()));

alter table public.support_tickets
  add column if not exists assigned_at timestamptz;

create table if not exists public.support_internal_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 6000),
  created_at timestamptz not null default now()
);
create index if not exists support_internal_notes_ticket_idx
  on public.support_internal_notes(ticket_id,created_at);

alter table public.support_internal_notes enable row level security;
drop policy if exists support_internal_notes_read on public.support_internal_notes;
create policy support_internal_notes_read on public.support_internal_notes
for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id=support_internal_notes.ticket_id
      and (
        (t.channel='owner' and private.is_owner())
        or (t.channel='admin' and private.is_admin())
      )
  )
);
drop policy if exists support_internal_notes_insert on public.support_internal_notes;
create policy support_internal_notes_insert on public.support_internal_notes
for insert to authenticated
with check (
  author_id=(select auth.uid())
  and exists (
    select 1 from public.support_tickets t
    where t.id=support_internal_notes.ticket_id
      and t.status<>'closed'
      and (
        (t.channel='owner' and private.is_owner())
        or (t.channel='admin' and private.is_admin())
      )
  )
);

create table if not exists public.support_ticket_events (
  id bigint generated by default as identity primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  old_status text,
  new_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists support_ticket_events_ticket_idx
  on public.support_ticket_events(ticket_id,created_at);

alter table public.support_ticket_events enable row level security;
drop policy if exists support_ticket_events_read on public.support_ticket_events;
create policy support_ticket_events_read on public.support_ticket_events
for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id=support_ticket_events.ticket_id
      and private.can_access_app()
      and (
        t.created_by=(select auth.uid())
        or (t.channel='owner' and private.is_owner())
        or (t.channel='admin' and private.is_admin())
      )
  )
);

drop policy if exists gallery_read on public.gallery_items;
create policy gallery_read on public.gallery_items
for select to authenticated
using (
  private.can_access_app()
  and (
    uploader_id=(select auth.uid())
    or private.is_admin()
    or (
      deleted_at is null
      and approved=true
      and (gallery_visible=true or profile_visible=true)
    )
  )
);

drop policy if exists gallery_delete on public.gallery_items;
create policy gallery_delete on public.gallery_items
for delete to authenticated using (false);

create or replace function public.trash_primary_media(p_owner_id uuid,p_media_type text)
returns uuid
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  uid uuid:=auth.uid();
  path text;
  b text;
  tid uuid;
begin
  if p_media_type not in ('avatar','vehicle') then raise exception 'Ungültiger Bildtyp'; end if;
  if uid<>p_owner_id and not private.is_admin() then raise exception 'Keine Berechtigung'; end if;

  if p_media_type='avatar' then
    select avatar_path into path from public.profiles where id=p_owner_id for update;
    if path is null then raise exception 'Kein Profilbild vorhanden'; end if;
    b:='avatars';
    update public.profiles set avatar_path=null where id=p_owner_id;
  else
    select photo_path into path from public.vehicles where user_id=p_owner_id for update;
    if path is null then raise exception 'Kein Fahrzeugbild vorhanden'; end if;
    b:='crew-media';
    update public.vehicles set photo_path=null where user_id=p_owner_id;
  end if;

  insert into public.profile_media_trash(owner_id,media_type,bucket,storage_path,deleted_by)
  values(p_owner_id,p_media_type,b,path,uid)
  on conflict(owner_id,media_type,storage_path)
  do update set deleted_by=excluded.deleted_by,deleted_at=now()
  returning id into tid;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(uid,'profile_media_trash','profile_media',tid::text,
    jsonb_build_object('owner_id',p_owner_id,'media_type',p_media_type,'bucket',b,'storage_path',path));

  return tid;
end;
$fn$;

create or replace function public.restore_primary_media(p_trash_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  uid uuid:=auth.uid();
  t public.profile_media_trash%rowtype;
  current_path text;
begin
  select * into t from public.profile_media_trash where id=p_trash_id for update;
  if t.id is null then raise exception 'Bild nicht gefunden'; end if;
  if uid<>t.owner_id and not private.is_admin() then raise exception 'Keine Berechtigung'; end if;

  if t.media_type='avatar' then
    select avatar_path into current_path from public.profiles where id=t.owner_id for update;
    if current_path is not null then raise exception 'Es ist bereits ein neues Profilbild gesetzt'; end if;
    update public.profiles set avatar_path=t.storage_path where id=t.owner_id;
  else
    select photo_path into current_path from public.vehicles where user_id=t.owner_id for update;
    if current_path is not null then raise exception 'Es ist bereits ein neues Fahrzeugbild gesetzt'; end if;
    update public.vehicles set photo_path=t.storage_path where user_id=t.owner_id;
  end if;

  delete from public.profile_media_trash where id=t.id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(uid,'profile_media_restore','profile_media',t.id::text,
    jsonb_build_object('owner_id',t.owner_id,'media_type',t.media_type,'storage_path',t.storage_path));
  return true;
end;
$fn$;

create or replace function public.delete_primary_media_permanently(p_trash_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  uid uuid:=auth.uid();
  t public.profile_media_trash%rowtype;
begin
  select * into t from public.profile_media_trash where id=p_trash_id for update;
  if t.id is null then return true; end if;
  if uid<>t.owner_id and not private.is_admin() then raise exception 'Keine Berechtigung'; end if;

  delete from public.profile_media_trash where id=t.id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(uid,'profile_media_delete_permanent','profile_media',t.id::text,
    jsonb_build_object('owner_id',t.owner_id,'media_type',t.media_type,'bucket',t.bucket,'storage_path',t.storage_path));
  return true;
end;
$fn$;

revoke all on function public.trash_primary_media(uuid,text) from public;
revoke all on function public.restore_primary_media(uuid) from public;
revoke all on function public.delete_primary_media_permanently(uuid) from public;
grant execute on function public.trash_primary_media(uuid,text) to authenticated;
grant execute on function public.restore_primary_media(uuid) to authenticated;
grant execute on function public.delete_primary_media_permanently(uuid) to authenticated;

create or replace function public.trash_gallery_item(p_id uuid)
returns table(storage_path text, deleted_at timestamptz)
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  g public.gallery_items%rowtype;
  uid uuid := auth.uid();
begin
  select * into g from public.gallery_items where id=p_id for update;
  if g.id is null then raise exception 'Bild nicht gefunden'; end if;
  if g.uploader_id<>uid and not private.is_admin() then raise exception 'Keine Berechtigung'; end if;

  update public.gallery_items
  set deleted_at=coalesce(public.gallery_items.deleted_at,now()),
      deleted_by=uid
  where id=p_id;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(uid,'gallery_trash','gallery_item',p_id::text,
    jsonb_build_object('uploader_id',g.uploader_id,'caption',g.caption));

  return query
  select x.storage_path,x.deleted_at from public.gallery_items x where x.id=p_id;
end;
$fn$;

create or replace function public.restore_gallery_item(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  g public.gallery_items%rowtype;
  uid uuid := auth.uid();
begin
  select * into g from public.gallery_items where id=p_id for update;
  if g.id is null then raise exception 'Bild nicht gefunden'; end if;
  if g.uploader_id<>uid and not private.is_admin() then raise exception 'Keine Berechtigung'; end if;
  if g.deleted_at is null then return true; end if;

  update public.gallery_items
  set deleted_at=null,deleted_by=null,deletion_reason=''
  where id=p_id;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(uid,'gallery_restore','gallery_item',p_id::text,
    jsonb_build_object('uploader_id',g.uploader_id,'caption',g.caption));
  return true;
end;
$fn$;

create or replace function public.delete_gallery_row_permanently(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  g public.gallery_items%rowtype;
  uid uuid := auth.uid();
begin
  select * into g from public.gallery_items where id=p_id for update;
  if g.id is null then return true; end if;
  if g.uploader_id<>uid and not private.is_admin() then raise exception 'Keine Berechtigung'; end if;
  if g.deleted_at is null then raise exception 'Bild muss zuerst in den Papierkorb'; end if;

  delete from public.gallery_items where id=p_id;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(uid,'gallery_delete_permanent','gallery_item',p_id::text,
    jsonb_build_object('uploader_id',g.uploader_id,'caption',g.caption,'storage_path',g.storage_path));
  return true;
end;
$fn$;

revoke all on function public.trash_gallery_item(uuid) from public;
revoke all on function public.restore_gallery_item(uuid) from public;
revoke all on function public.delete_gallery_row_permanently(uuid) from public;
grant execute on function public.trash_gallery_item(uuid) to authenticated;
grant execute on function public.restore_gallery_item(uuid) to authenticated;
grant execute on function public.delete_gallery_row_permanently(uuid) to authenticated;

create or replace function private.touch_support_ticket_from_message()
returns trigger
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  t public.support_tickets%rowtype;
  sender_role text;
  next_status text;
begin
  select * into t from public.support_tickets where id=new.ticket_id for update;
  if t.id is null then raise exception 'Ticket nicht gefunden'; end if;
  if t.status='closed' then raise exception 'Ticket ist geschlossen'; end if;

  select role into sender_role from public.profiles where id=new.sender_id;
  next_status:=t.status;

  if new.sender_id=t.created_by then
    if t.status='waiting_user' then next_status:='open'; end if;
  elsif sender_role in ('admin','owner') then
    if t.status='open' then next_status:='waiting_user'; end if;
  end if;

  update public.support_tickets
  set updated_at=now(),status=next_status
  where id=t.id;

  if next_status is distinct from t.status then
    insert into public.support_ticket_events(ticket_id,actor_id,event_type,old_status,new_status,details)
    values(t.id,new.sender_id,'status_auto',t.status,next_status,'{}'::jsonb);
  end if;

  return new;
end;
$fn$;

drop trigger if exists support_message_touch_ticket on public.support_messages;
create trigger support_message_touch_ticket
before insert on public.support_messages
for each row execute function private.touch_support_ticket_from_message();

create or replace function private.support_staff_allowed(t public.support_tickets)
returns boolean
language sql
stable
security definer
set search_path=public,private
as $fn$
  select case
    when t.channel='owner' then private.is_owner()
    when t.channel='admin' then private.is_admin()
    else false
  end;
$fn$;

create or replace function public.claim_support_ticket(p_ticket_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  t public.support_tickets%rowtype;
  uid uuid:=auth.uid();
begin
  select * into t from public.support_tickets where id=p_ticket_id for update;
  if t.id is null then raise exception 'Ticket nicht gefunden'; end if;
  if not private.support_staff_allowed(t) then raise exception 'Keine Berechtigung'; end if;
  if t.status='closed' then raise exception 'Ticket ist geschlossen'; end if;

  update public.support_tickets
  set assigned_to=uid,assigned_at=now(),status='in_progress',updated_at=now()
  where id=t.id;

  insert into public.support_ticket_events(ticket_id,actor_id,event_type,old_status,new_status,details)
  values(t.id,uid,'claimed',t.status,'in_progress',jsonb_build_object('assigned_to',uid));

  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(uid,'support_claim','support_ticket',t.id::text,jsonb_build_object('ticket_no',t.ticket_no));
  return true;
end;
$fn$;

create or replace function public.set_support_ticket_status(p_ticket_id uuid,p_status text)
returns boolean
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  t public.support_tickets%rowtype;
  uid uuid:=auth.uid();
begin
  if p_status not in ('open','in_progress','waiting_user') then
    raise exception 'Ungültiger Status';
  end if;

  select * into t from public.support_tickets where id=p_ticket_id for update;
  if t.id is null then raise exception 'Ticket nicht gefunden'; end if;
  if not private.support_staff_allowed(t) then raise exception 'Keine Berechtigung'; end if;
  if t.status='closed' then raise exception 'Ticket ist geschlossen'; end if;

  update public.support_tickets
  set status=p_status,
      assigned_to=case when p_status='in_progress' then coalesce(assigned_to,uid) else assigned_to end,
      assigned_at=case when p_status='in_progress' then coalesce(assigned_at,now()) else assigned_at end,
      updated_at=now()
  where id=t.id;

  if p_status is distinct from t.status then
    insert into public.support_ticket_events(ticket_id,actor_id,event_type,old_status,new_status,details)
    values(t.id,uid,'status_manual',t.status,p_status,'{}'::jsonb);
  end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(uid,'support_status','support_ticket',t.id::text,
    jsonb_build_object('ticket_no',t.ticket_no,'from',t.status,'to',p_status));
  return true;
end;
$fn$;

create or replace function public.close_support_ticket(p_ticket_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,private
as $fn$
declare
  t public.support_tickets%rowtype;
  uid uuid:=auth.uid();
begin
  select * into t from public.support_tickets where id=p_ticket_id for update;
  if t.id is null then raise exception 'Ticket nicht gefunden'; end if;
  if uid<>t.created_by and not private.support_staff_allowed(t) then raise exception 'Keine Berechtigung'; end if;
  if t.status='closed' then return true; end if;

  update public.support_tickets
  set status='closed',closed_at=now(),updated_at=now()
  where id=t.id;

  insert into public.support_ticket_events(ticket_id,actor_id,event_type,old_status,new_status,details)
  values(t.id,uid,'closed',t.status,'closed','{}'::jsonb);

  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(uid,'support_close','support_ticket',t.id::text,jsonb_build_object('ticket_no',t.ticket_no));
  return true;
end;
$fn$;

revoke all on function public.claim_support_ticket(uuid) from public;
revoke all on function public.set_support_ticket_status(uuid,text) from public;
revoke all on function public.close_support_ticket(uuid) from public;
grant execute on function public.claim_support_ticket(uuid) to authenticated;
grant execute on function public.set_support_ticket_status(uuid,text) to authenticated;
grant execute on function public.close_support_ticket(uuid) to authenticated;

create or replace function private.audit_crew_place_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $fn$
declare
  uid uuid:=auth.uid();
begin
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(
    uid,
    case when tg_op='INSERT' then 'crew_place_create'
         when tg_op='UPDATE' then 'crew_place_update'
         else 'crew_place_delete' end,
    'crew_place',
    coalesce(new.id,old.id)::text,
    jsonb_build_object('name',coalesce(new.name,old.name))
  );
  return coalesce(new,old);
end;
$fn$;

drop trigger if exists crew_places_audit on public.crew_places;
create trigger crew_places_audit
after insert or update or delete on public.crew_places
for each row execute function private.audit_crew_place_change();

grant select,insert,update on public.user_preferences to authenticated;
grant select,insert,update,delete on public.crew_places to authenticated;
grant select,insert,update,delete on public.app_notification_reads to authenticated;
grant select,insert on public.support_internal_notes to authenticated;
grant select on public.support_ticket_events to authenticated;

-- Ticket status changes are only allowed through the explicit workflow RPCs.
revoke update on public.support_tickets from authenticated;
grant select,insert on public.support_tickets to authenticated;

create or replace function private.audit_profile_role_labels()
returns trigger
language plpgsql
security definer
set search_path=public
as $fn$
begin
  if old.role is distinct from new.role or old.labels is distinct from new.labels then
    insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
    values(
      auth.uid(),'profile_admin_change','profile',new.id::text,
      jsonb_build_object('name',new.display_name,'old_role',old.role,'new_role',new.role,'old_labels',old.labels,'new_labels',new.labels)
    );
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_admin_audit on public.profiles;
create trigger profiles_admin_audit
after update on public.profiles
for each row execute function private.audit_profile_role_labels();

create or replace function private.audit_content_admin_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $fn$
declare
  row_json jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  entity_uuid text:=coalesce(row_json->>'id','');
  action_name text;
begin
  if tg_table_name='events' then action_name:=case when tg_op='INSERT' then 'event_create' else 'event_delete' end;
  else action_name:=case when tg_op='INSERT' then 'announcement_create' else 'announcement_delete' end;
  end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),action_name,tg_table_name,entity_uuid,
    jsonb_build_object('title',coalesce(row_json->>'name',row_json->>'title','')));
  return case when tg_op='DELETE' then old else new end;
end;
$fn$;

drop trigger if exists events_admin_audit on public.events;
create trigger events_admin_audit
after insert or delete on public.events
for each row execute function private.audit_content_admin_change();

drop trigger if exists announcements_admin_audit on public.announcements;
create trigger announcements_admin_audit
after insert or delete on public.announcements
for each row execute function private.audit_content_admin_change();

do $do$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='support_internal_notes'
  ) then
    alter publication supabase_realtime add table public.support_internal_notes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='support_ticket_events'
  ) then
    alter publication supabase_realtime add table public.support_ticket_events;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='crew_places'
  ) then
    alter publication supabase_realtime add table public.crew_places;
  end if;
end;
$do$;

insert into public.update_releases(version,build,title,notes,active,published_at)
values (
  '3.4.0',
  '2026-09-25.1',
  'Einfacher. Persönlicher. Mehr Kontrolle.',
  '[
    {"roles":["member","admin","owner"],"title":"Bilder im Griff","body":"Du kannst deine eigenen Bilder löschen. Sie bleiben 7 Tage im Papierkorb und können wiederhergestellt werden."},
    {"roles":["member","admin","owner"],"title":"Support ist klarer","body":"Nach dem Absenden bekommst du sofort eine Bestätigung. Der Ticket-Status ändert sich passend zum Gespräch."},
    {"roles":["member","admin","owner"],"title":"Dein Benachrichtigungssound","body":"Wähle in der App deinen bevorzugten Sound – zum Beispiel Motorstart, Turbo oder einen dezenten Ton."},
    {"roles":["member","admin","owner"],"title":"Persönliches Home","body":"Die App begrüßt dich mit deinem Namen und zeigt dir wichtige Dinge direkt auf der Startseite."},
    {"roles":["member","admin","owner"],"title":"Benachrichtigungen sortiert","body":"Ankündigungen, Support, Events und Systemmeldungen sind jetzt übersichtlicher getrennt."},
    {"roles":["member","admin","owner"],"title":"Mehr Privatsphäre","body":"Du entscheidest, welche Profil- und Fahrzeugdetails andere Crew-Mitglieder sehen."},
    {"roles":["member","admin","owner"],"title":"Crew-Orte","body":"Häufige Treffpunkte können gespeichert und beim Erstellen eines Treffens direkt ausgewählt werden."},
    {"roles":["admin","owner"],"title":"Mehr Kontrolle über Bilder","body":"Admins können Crew-Bilder in den Papierkorb legen, wiederherstellen oder endgültig entfernen."},
    {"roles":["admin","owner"],"title":"Support übernehmen","body":"Tickets können einem Admin zugewiesen werden. Interne Notizen bleiben nur für das Support-Team sichtbar."},
    {"roles":["admin","owner"],"title":"Admin-Verlauf","body":"Wichtige Änderungen wie gelöschte Bilder, Ticket-Status und Crew-Orte sind nachvollziehbar protokolliert."}
  ]'::jsonb,
  true,
  now()
)
on conflict (version) do update
set build=excluded.build,title=excluded.title,notes=excluded.notes,active=true,published_at=excluded.published_at;

-- Daily physical cleanup for gallery trash older than 7 days.
do $do$
declare
  old_job bigint;
begin
  select jobid into old_job from cron.job where jobname='4w1f-media-trash-cleanup' limit 1;
  if old_job is not null then perform cron.unschedule(old_job); end if;
end;
$do$;

select cron.schedule(
  '4w1f-media-trash-cleanup',
  '35 3 * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='4w1f_project_url')
           || '/functions/v1/media-trash-cleanup',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-4w1f-cron',(select decrypted_secret from vault.decrypted_secrets where name='4w1f_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);


-- Final privilege hardening and FK indexes.
create index if not exists crew_places_created_by_idx on public.crew_places(created_by);
create index if not exists gallery_items_deleted_by_idx on public.gallery_items(deleted_by);
create index if not exists profile_media_trash_deleted_by_idx on public.profile_media_trash(deleted_by);
create index if not exists support_internal_notes_author_idx on public.support_internal_notes(author_id);
create index if not exists support_ticket_events_actor_idx on public.support_ticket_events(actor_id);

revoke execute on function public.trash_gallery_item(uuid) from anon;
revoke execute on function public.restore_gallery_item(uuid) from anon;
revoke execute on function public.delete_gallery_row_permanently(uuid) from anon;
revoke execute on function public.trash_primary_media(uuid,text) from anon;
revoke execute on function public.restore_primary_media(uuid) from anon;
revoke execute on function public.delete_primary_media_permanently(uuid) from anon;
revoke execute on function public.claim_support_ticket(uuid) from anon;
revoke execute on function public.set_support_ticket_status(uuid,text) from anon;
revoke execute on function public.close_support_ticket(uuid) from anon;
