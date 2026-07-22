-- Espaço Luo — schema inicial: perfis, papéis (admin/user), salas e agendamentos.
-- Este arquivo reflete o schema que já está aplicado no projeto Supabase
-- (rodado direto no SQL Editor do painel antes deste commit).

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ── Tipos ──────────────────────────────────────────────────────────────────

create type public.app_role as enum ('admin', 'user');
create type public.booking_status as enum ('confirmed', 'cancelled');

-- ── Perfis ─────────────────────────────────────────────────────────────────
-- Uma linha por usuário do Supabase Auth, com dados públicos/seguros de exibir.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Usuários veem o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuários atualizam o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- ── Papéis (roles) ─────────────────────────────────────────────────────────
-- Separado de profiles de propósito: se estivesse na mesma tabela, um usuário
-- poderia se auto-promover a admin editando o próprio perfil.

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- security definer: evita recursão infinita das policies de RLS ao checar papel.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Usuários veem os próprios papéis"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Admins veem todos os papéis"
  on public.user_roles for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins gerenciam papéis"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins veem todos os perfis"
  on public.profiles for select
  using (public.has_role(auth.uid(), 'admin'));

-- ── Provisionamento automático ao criar usuário ────────────────────────────
-- Sempre que alguém é criado em auth.users (login normal ou admin.createUser),
-- cria o profile e atribui o papel padrão. O e-mail abaixo vira admin
-- automaticamente — é o único jeito de existir um primeiro admin sem já ter
-- um admin para criá-lo.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    case when new.email = 'maiaraac@gmail.com' then 'admin' else 'user' end::public.app_role
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Salas (consultórios) ───────────────────────────────────────────────────

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  capacity integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "Usuários autenticados veem salas ativas"
  on public.rooms for select
  using (is_active or public.has_role(auth.uid(), 'admin'));

create policy "Admins gerenciam salas"
  on public.rooms for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── Agendamentos ───────────────────────────────────────────────────────────

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  notes text,
  created_at timestamptz not null default now(),
  constraint bookings_time_order check (ends_at > starts_at),
  -- Impede dois agendamentos confirmados sobrepostos na mesma sala.
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);

alter table public.bookings enable row level security;

create index bookings_room_id_idx on public.bookings (room_id);
create index bookings_user_id_idx on public.bookings (user_id);

create policy "Usuários autenticados veem todos os agendamentos"
  on public.bookings for select
  using (auth.uid() is not null);

create policy "Usuários criam os próprios agendamentos"
  on public.bookings for insert
  with check (auth.uid() = user_id);

create policy "Usuários alteram os próprios agendamentos"
  on public.bookings for update
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Usuários cancelam/apagam os próprios agendamentos"
  on public.bookings for delete
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins gerenciam todos os agendamentos"
  on public.bookings for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
