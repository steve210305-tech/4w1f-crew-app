-- 4W1F 3.3.0 final backend step.
-- Apply immediately before merging the prepared app branch.

drop policy if exists gallery_read on public.gallery_items;
create policy gallery_read on public.gallery_items
for select to authenticated
using (
  private.can_access_app()
  and (
    uploader_id=(select auth.uid())
    or (approved=true and (gallery_visible=true or profile_visible=true))
  )
);

create index if not exists support_tickets_created_by_idx on public.support_tickets(created_by);
create index if not exists support_tickets_assigned_to_idx on public.support_tickets(assigned_to);
create index if not exists support_tickets_channel_updated_idx on public.support_tickets(channel,updated_at desc);
create index if not exists support_messages_ticket_created_idx on public.support_messages(ticket_id,created_at);
create index if not exists support_messages_sender_idx on public.support_messages(sender_id);
create index if not exists support_reads_user_idx on public.support_ticket_reads(user_id);
create index if not exists social_drafts_created_by_idx on public.social_drafts(created_by);
create index if not exists update_receipts_user_idx on public.update_receipts(user_id);

create or replace function public.set_4w1f_updated_at()
returns trigger
language plpgsql
set search_path=public
as $
begin
  new.updated_at=now();
  return new;
end;
$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('support-media','support-media',false,12582912,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists support_media_read on storage.objects;
create policy support_media_read on storage.objects
for select to authenticated
using (
  bucket_id='support-media'
  and exists (
    select 1
    from public.support_tickets t
    where t.id=((storage.foldername(name))[1])::uuid
      and (
        t.created_by=(select auth.uid())
        or (t.channel='owner' and private.is_owner())
        or (t.channel='admin' and private.is_admin())
      )
  )
);

drop policy if exists support_media_insert on storage.objects;
create policy support_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='support-media'
  and (storage.foldername(name))[2]=((select auth.uid()))::text
  and exists (
    select 1
    from public.support_tickets t
    where t.id=((storage.foldername(name))[1])::uuid
      and t.status<>'closed'
      and (
        t.created_by=(select auth.uid())
        or (t.channel='owner' and private.is_owner())
        or (t.channel='admin' and private.is_admin())
      )
  )
);

drop policy if exists support_media_delete on storage.objects;
create policy support_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id='support-media'
  and (
    (storage.foldername(name))[2]=((select auth.uid()))::text
    or private.is_admin()
  )
);

-- Initial ticket creation and first message used to create two pushes.
-- The message is the single push source.
drop trigger if exists support_ticket_push on public.support_tickets;

create or replace function private.touch_support_ticket_from_message()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.support_tickets
  set updated_at=now(),
      status=case
        when created_by=new.sender_id and status='waiting_user' then 'open'
        else status
      end
  where id=new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_message_touch_ticket on public.support_messages;
create trigger support_message_touch_ticket
before insert on public.support_messages
for each row execute function private.touch_support_ticket_from_message();

create or replace function private.notify_support_message()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.support_tickets%rowtype;
  recipient record;
  sender_name text;
begin
  select * into t from public.support_tickets where id=new.ticket_id;
  select display_name into sender_name from public.profiles where id=new.sender_id;

  for recipient in
    select distinct p.id
    from public.profiles p
    where p.active=true
      and p.id<>new.sender_id
      and (
        p.id=t.created_by
        or (t.channel='owner' and p.role='owner')
        or (t.channel='admin' and p.role in ('owner','admin'))
      )
  loop
    insert into public.notification_outbox
      (user_id,kind,title,body,target_url,tag,source_id,dedupe_key)
    values (
      recipient.id,
      'support',
      case
        when new.sender_id=t.created_by then 'Neues Support-Ticket #'||t.ticket_no
        else 'Neue Antwort in Ticket #'||t.ticket_no
      end,
      coalesce(sender_name,'Support')||': '||
        left(coalesce(nullif(new.body,''),'Bild angehängt'),120),
      './?support='||t.id::text,
      'support-ticket-'||t.id::text,
      t.id,
      'support-message-'||new.id::text||'-'||recipient.id::text
    )
    on conflict (dedupe_key) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists support_message_push on public.support_messages;
create trigger support_message_push
after insert on public.support_messages
for each row execute function private.notify_support_message();

update public.update_releases
set build='2026-09-23.1',
    active=true,
    published_at=now()
where version='3.3.0';
