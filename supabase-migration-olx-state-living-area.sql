alter table public.properties
  add column if not exists state text,
  add column if not exists living_area numeric(12, 2);

alter table public.properties
  add constraint properties_state_check
  check (state is null or state ~ '^[A-Z]{2}$')
  not valid;

alter table public.properties
  add constraint properties_living_area_check
  check (living_area is null or living_area >= 0)
  not valid;

alter table public.properties validate constraint properties_state_check;
alter table public.properties validate constraint properties_living_area_check;
