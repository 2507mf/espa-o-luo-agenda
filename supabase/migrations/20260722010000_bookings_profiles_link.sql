-- Aditivo: liga bookings.user_id a profiles(id) além de auth.users(id),
-- para o PostgREST conseguir embutir profiles(full_name) nas consultas
-- de agenda (mostrar quem reservou). Não remove a FK existente para
-- auth.users nem altera dados.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_user_id_profiles_fkey'
  ) then
    alter table public.bookings
      add constraint bookings_user_id_profiles_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;
end $$;
