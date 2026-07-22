-- Espaço Luo — catálogo de planos (combos, mensalista, avulso) e créditos de uso.
-- Rode este arquivo no SQL Editor do Supabase depois das migrações anteriores.

-- ── Tipos ──────────────────────────────────────────────────────────────────
create type public.plan_type as enum ('combo', 'mensalista', 'turno_avulso', 'hora_avulsa');
create type public.plan_unit as enum ('turno', 'hora');

-- ── Catálogo de planos ─────────────────────────────────────────────────────
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  name text not null,
  plan_type public.plan_type not null,
  price numeric(10,2) not null,
  units_included integer not null,
  unit public.plan_unit not null,
  validity_days integer, -- null = sem prazo de validade (turno/hora avulsos)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy "Usuários autenticados veem planos ativos"
  on public.plans for select
  using (is_active or public.has_role(auth.uid(), 'admin'));

create policy "Admins gerenciam planos"
  on public.plans for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── Compras / créditos de uso ──────────────────────────────────────────────
-- Cada linha é uma venda registrada pelo admin (pagamento acontece por fora).
-- Preço/unidades são copiados do plano no momento da compra, então editar o
-- catálogo depois não altera vendas já registradas.
create table public.plan_purchases (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  price_paid numeric(10,2) not null,
  unit public.plan_unit not null,
  units_included integer not null,
  units_used integer not null default 0,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint plan_purchases_units_check check (units_used >= 0 and units_used <= units_included)
);

alter table public.plan_purchases enable row level security;

create policy "Usuários veem as próprias compras"
  on public.plan_purchases for select
  using (auth.uid() = user_id);

create policy "Admins veem todas as compras"
  on public.plan_purchases for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins registram compras"
  on public.plan_purchases for insert
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins atualizam compras"
  on public.plan_purchases for update
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins apagam compras"
  on public.plan_purchases for delete
  using (public.has_role(auth.uid(), 'admin'));

-- ── Liga agendamentos a uma compra (opcional) ──────────────────────────────
alter table public.bookings
  add column plan_purchase_id uuid references public.plan_purchases (id) on delete set null;

-- ── Função: agenda um turno/hora avulso gastando 1 crédito da compra ───────
-- SECURITY DEFINER para poder atualizar plan_purchases (que o usuário comum
-- não pode escrever diretamente), mas valida que a compra é do próprio
-- usuário, não expirou e ainda tem crédito antes de gastar.
create or replace function public.book_plan_shift(
  _plan_purchase_id uuid,
  _room_id uuid,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  _purchase public.plan_purchases;
  _plan public.plans;
  _booking public.bookings;
begin
  select * into _purchase from public.plan_purchases where id = _plan_purchase_id;

  if _purchase is null then
    raise exception 'Compra não encontrada.';
  end if;

  if _purchase.user_id <> auth.uid() then
    raise exception 'Esta compra não pertence a você.';
  end if;

  if _purchase.expires_at is not null and _purchase.expires_at < now() then
    raise exception 'Este crédito expirou.';
  end if;

  if _purchase.units_used >= _purchase.units_included then
    raise exception 'Não há créditos restantes nesta compra.';
  end if;

  select * into _plan from public.plans where id = _purchase.plan_id;

  if _plan.room_id <> _room_id then
    raise exception 'Este crédito não é válido para a sala escolhida.';
  end if;

  insert into public.bookings (room_id, user_id, starts_at, ends_at, notes, plan_purchase_id)
  values (_room_id, auth.uid(), _starts_at, _ends_at, _notes, _plan_purchase_id)
  returning * into _booking;

  update public.plan_purchases
  set units_used = units_used + 1
  where id = _plan_purchase_id;

  return _booking;
end;
$$;

grant execute on function public.book_plan_shift(uuid, uuid, timestamptz, timestamptz, text) to authenticated;

-- ── Função: devolve o crédito quando o agendamento vinculado é cancelado ───
create or replace function public.refund_plan_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.plan_purchase_id is not null then
    update public.plan_purchases
    set units_used = greatest(units_used - 1, 0)
    where id = old.plan_purchase_id;
  end if;
  return old;
end;
$$;

create trigger on_booking_deleted_refund_credit
  after delete on public.bookings
  for each row execute function public.refund_plan_credit();

-- ── Salas reais ──────────────────────────────────────────────────────────
insert into public.rooms (name, is_active)
select v.name, true
from (values ('Consultório 1'), ('Consultório 2')) as v(name)
where not exists (select 1 from public.rooms r where r.name = v.name);

-- ── Catálogo inicial de planos ──────────────────────────────────────────────
insert into public.plans (room_id, name, plan_type, price, units_included, unit, validity_days)
select r.id, p.name, p.plan_type, p.price, p.units_included, p.unit, p.validity_days
from (values
  ('Consultório 1', 'Combo de 2 turnos', 'combo'::public.plan_type, 380.00, 2, 'turno'::public.plan_unit, 30),
  ('Consultório 2', 'Combo de 2 turnos', 'combo'::public.plan_type, 320.00, 2, 'turno'::public.plan_unit, 30),
  ('Consultório 1', 'Combo de 4 turnos', 'combo'::public.plan_type, 760.00, 4, 'turno'::public.plan_unit, 60),
  ('Consultório 2', 'Combo de 4 turnos', 'combo'::public.plan_type, 640.00, 4, 'turno'::public.plan_unit, 60),
  ('Consultório 1', 'Mensalista', 'mensalista'::public.plan_type, 720.00, 4, 'turno'::public.plan_unit, 30),
  ('Consultório 2', 'Mensalista', 'mensalista'::public.plan_type, 612.00, 4, 'turno'::public.plan_unit, 30),
  ('Consultório 1', 'Turno avulso', 'turno_avulso'::public.plan_type, 200.00, 1, 'turno'::public.plan_unit, null::integer),
  ('Consultório 2', 'Turno avulso', 'turno_avulso'::public.plan_type, 170.00, 1, 'turno'::public.plan_unit, null::integer),
  ('Consultório 1', 'Hora avulsa', 'hora_avulsa'::public.plan_type, 70.00, 1, 'hora'::public.plan_unit, null::integer),
  ('Consultório 2', 'Hora avulsa', 'hora_avulsa'::public.plan_type, 50.00, 1, 'hora'::public.plan_unit, null::integer)
) as p(room_name, name, plan_type, price, units_included, unit, validity_days)
join public.rooms r on r.name = p.room_name
where not exists (
  select 1 from public.plans existing
  where existing.room_id = r.id and existing.name = p.name
);
