-- Zarzu: esquema completo. Ejecútalo una vez en Supabase > SQL Editor.
-- Cada tabla de usuario tiene Row Level Security: nadie puede leer ni escribir datos de otro.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  favorite_place jsonb,
  appearance jsonb not null default '{}',
  notifications jsonb not null default '{}',
  timezone text default 'Europe/Madrid',
  updated_at timestamptz not null default now()
);

create table if not exists public.app_admins (user_id uuid primary key references auth.users(id) on delete cascade);

-- Registro de versículos mostrados. La clave (user_id, shown_on) impide dos versículos el mismo día,
-- aunque dos dispositivos elijan a la vez: gana el primero y el otro adopta su elección.
create table if not exists public.verse_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  shown_on date not null,
  verse_id text not null check (char_length(verse_id) <= 40),
  created_at timestamptz not null default now(),
  primary key (user_id, shown_on)
);
create index if not exists verse_history_user_verse on public.verse_history (user_id, verse_id);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('verse','prayer','saint','quote','news','place')),
  item_id text not null check (char_length(item_id) <= 200),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);

create table if not exists public.activity_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reading','gospel','prayer','rosary')),
  ref text not null check (char_length(ref) <= 120),
  label text check (char_length(label) <= 160),
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref, day)
);
create index if not exists activity_user_day on public.activity_log (user_id, day desc);

create table if not exists public.conversations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Conversación' check (char_length(title) <= 120),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 20000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv on public.messages (conversation_id, created_at);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null, auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_user on public.push_subscriptions (user_id);

-- Solo lo usa el cron con la clave de servicio.
create table if not exists public.push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_id text not null, day date not null,
  primary key (user_id, reminder_id, day)
);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

-- Horarios comprobados: exigen fuente y fecha de comprobación.
create table if not exists public.verified_schedules (
  id uuid primary key default gen_random_uuid(),
  osm_ref text not null check (osm_ref ~ '^(node|way|relation)/[0-9]+$'),
  church_name text not null,
  kind text not null check (kind in ('mass','confession','opening')),
  schedule text not null check (char_length(schedule) between 3 and 2000),
  source_url text not null check (source_url ~ '^https?://'),
  source_name text,
  checked_on date not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (osm_ref, kind)
);

-- Contenido editorial gestionado desde el panel de administración.
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily_message','morning_reflection','announcement')),
  title text, body text not null check (char_length(body) between 3 and 5000),
  publish_on date,
  published boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists content_publish on public.content_items (kind, publish_on);

-- Función auxiliar: ¿es administrador el usuario actual?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.app_admins where user_id = auth.uid()) $$;

-- Contador atómico de mensajes de IA por día.
create or replace function public.consume_ai_quota(daily_limit int default 40) returns boolean
language plpgsql security definer set search_path = public as $$
declare used int;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into used;
  return used <= daily_limit;
end $$;

-- Permite a cada persona borrar su cuenta y, en cascada, todos sus datos.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Perfil automático al registrarse.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 80))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
alter table public.verse_history enable row level security;
alter table public.favorites enable row level security;
alter table public.activity_log enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;
alter table public.ai_usage enable row level security;
alter table public.verified_schedules enable row level security;
alter table public.content_items enable row level security;

drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists own_admin_row on public.app_admins;
create policy own_admin_row on public.app_admins for select to authenticated using (user_id = auth.uid());
drop policy if exists own_verses on public.verse_history;
create policy own_verses on public.verse_history for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_favorites on public.favorites;
create policy own_favorites on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_activity on public.activity_log;
create policy own_activity on public.activity_log for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_conversations on public.conversations;
create policy own_conversations on public.conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_messages on public.messages;
create policy own_messages on public.messages for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists own_push on public.push_subscriptions;
create policy own_push on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- push_log y ai_usage: sin políticas. Solo acceden la clave de servicio y consume_ai_quota.

drop policy if exists read_schedules on public.verified_schedules;
create policy read_schedules on public.verified_schedules for select to anon, authenticated using (true);
drop policy if exists admin_schedules on public.verified_schedules;
create policy admin_schedules on public.verified_schedules for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists read_content on public.content_items;
create policy read_content on public.content_items for select to anon, authenticated using (published or public.is_admin());
drop policy if exists admin_content on public.content_items;
create policy admin_content on public.content_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Horarios de misa que envían los usuarios. No se muestran a nadie hasta que un
-- administrador los comprueba y los pasa a verified_schedules.
create table if not exists public.mass_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  osm_ref text not null check (osm_ref ~ '^(node|way|relation)/[0-9]+$'),
  church_name text not null check (char_length(church_name) between 2 and 200),
  schedule text not null check (char_length(schedule) between 4 and 600),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','used','rejected')),
  created_at timestamptz not null default now()
);
alter table public.mass_reports enable row level security;
drop policy if exists insert_own_report on public.mass_reports;
create policy insert_own_report on public.mass_reports for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
drop policy if exists read_own_report on public.mass_reports;
create policy read_own_report on public.mass_reports for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists admin_reports on public.mass_reports;
create policy admin_reports on public.mass_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.mass_reports to authenticated;

revoke all on public.push_log, public.ai_usage from anon, authenticated;
revoke execute on function public.consume_ai_quota(int) from anon, public;
grant execute on function public.consume_ai_quota(int) to authenticated;

revoke execute on function public.delete_my_account() from anon, public;
grant execute on function public.delete_my_account() to authenticated;
grant select, insert, update, delete on public.profiles, public.verse_history, public.favorites, public.activity_log, public.conversations, public.messages, public.push_subscriptions, public.verified_schedules, public.content_items to authenticated;
grant select on public.app_admins to authenticated;
grant select on public.verified_schedules, public.content_items to anon;

-- Para hacerte administrador, tras crear tu cuenta:
-- insert into public.app_admins (user_id) select id from auth.users where email = 'tu-correo@ejemplo.com';
