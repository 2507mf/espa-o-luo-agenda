-- Espaço Luo — schema inicial: perfis, papéis, salas e reservas.
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute uma única vez.

-- Extensão necessária para a restrição de sobreposição de horários (EXCLUDE ... gist)
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Papéis (nunca guardar o papel na tabela de perfis — evita escalonamento via RLS)
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Função SECURITY DEFINER: consultada pelas policies sem recursão de RLS.
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
  );
$$;

-- ---------------------------------------------------------------------------
-- Perfis (1 linha por usuário do auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Salas / consultórios
-- ---------------------------------------------------------------------------
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reservas (com trava de sobreposição por sala)
-- ---------------------------------------------------------------------------
create table public.bookings (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  -- Aponta para profiles (que referencia auth.users) para que o PostgREST
  -- consiga embutir os dados do usuário no join bookings -> profiles.
  user_id    uuid not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  notes      text,
  created_at timestamptz not null default now(),
  constraint bookings_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete cascade,
  constraint bookings_time_valid check (ends_at > starts_at),
  -- Impede duas reservas na mesma sala com horários que se cruzam.
  constraint bookings_no_overlap exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
);

create index bookings_room_starts_idx on public.bookings (room_id, starts_at);

-- ---------------------------------------------------------------------------
-- Ao criar um usuário: cria o perfil e atribui papel.
-- O primeiríssimo usuário cadastrado vira 'admin'; os demais viram 'user'.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count int;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  select count(*) into existing_count from public.user_roles;
  if existing_count = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.user_roles enable row level security;
alter table public.profiles  enable row level security;
alter table public.rooms     enable row level security;
alter table public.bookings  enable row level security;

-- user_roles: cada um vê o próprio papel; admin vê e gerencia todos.
create policy "roles_select_own_or_admin" on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "roles_admin_manage" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- profiles: todos os autenticados leem; cada um edita o próprio; admin edita qualquer.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated
  using (true);

create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

-- rooms: todos os autenticados leem; só admin cria/edita/apaga.
create policy "rooms_select_authenticated" on public.rooms
  for select to authenticated
  using (true);

create policy "rooms_admin_manage" on public.rooms
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- bookings: todos os autenticados leem (para ver disponibilidade);
-- cada um cria/edita/apaga as próprias; admin gerencia todas.
create policy "bookings_select_authenticated" on public.bookings
  for select to authenticated
  using (true);

create policy "bookings_insert_own" on public.bookings
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "bookings_update_own_or_admin" on public.bookings
  for update to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "bookings_delete_own_or_admin" on public.bookings
  for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
