-- Espaço Luo — autoatendimento: cliente escolhe plano + horário(s) direto no
-- site. A compra nasce "pendente" até o admin confirmar o pagamento (PIX
-- verificado manualmente, avisado via WhatsApp).

create type public.payment_status as enum ('pending', 'confirmed');

alter table public.plan_purchases
  add column payment_status public.payment_status not null default 'pending';

-- Autoatendimento: o próprio cliente pode registrar a compra (antes só admin).
create policy "Usuários registram as próprias compras"
  on public.plan_purchases for insert
  with check (auth.uid() = user_id);

-- ── Função: cria a compra + os agendamentos de uma vez, tudo ou nada ───────
-- _slots é um array json de objetos {"starts_at": "...", "ends_at": "..."}.
-- Se qualquer horário já estiver ocupado, a função inteira falha e nada é
-- criado (evita compra "presa" com só parte dos horários reservados).
create or replace function public.self_serve_purchase(
  _plan_id uuid,
  _slots jsonb,
  _notes text default null
)
returns public.plan_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  _plan public.plans;
  _purchase public.plan_purchases;
  _slot jsonb;
  _expires_at timestamptz;
begin
  select * into _plan from public.plans where id = _plan_id and is_active;
  if _plan is null then
    raise exception 'Plano não encontrado ou inativo.';
  end if;

  if jsonb_array_length(_slots) <> _plan.units_included then
    raise exception 'Número de horários selecionados não corresponde ao plano.';
  end if;

  _expires_at := case
    when _plan.validity_days is not null then now() + (_plan.validity_days || ' days')::interval
    else null
  end;

  insert into public.plan_purchases (
    plan_id, user_id, created_by, price_paid, unit, units_included, units_used,
    payment_status, expires_at
  ) values (
    _plan.id, auth.uid(), auth.uid(), _plan.price, _plan.unit, _plan.units_included, _plan.units_included,
    'pending', _expires_at
  )
  returning * into _purchase;

  for _slot in select * from jsonb_array_elements(_slots)
  loop
    insert into public.bookings (room_id, user_id, starts_at, ends_at, notes, plan_purchase_id)
    values (
      _plan.room_id,
      auth.uid(),
      (_slot ->> 'starts_at')::timestamptz,
      (_slot ->> 'ends_at')::timestamptz,
      _notes,
      _purchase.id
    );
  end loop;

  return _purchase;
end;
$$;

grant execute on function public.self_serve_purchase(uuid, jsonb, text) to authenticated;
