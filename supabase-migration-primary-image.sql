alter table public.property_images
  add column if not exists is_primary boolean not null default false;

with ranked_images as (
  select
    id,
    property_id,
    row_number() over (
      partition by property_id
      order by display_order, created_at, id
    ) as image_rank
  from public.property_images
)
update public.property_images as images
set is_primary = true
from ranked_images
where images.id = ranked_images.id
  and ranked_images.image_rank = 1
  and not exists (
    select 1
    from public.property_images as current_primary
    where current_primary.property_id = ranked_images.property_id
      and current_primary.is_primary
  );

create unique index if not exists property_images_one_primary_per_property_idx
  on public.property_images (property_id)
  where is_primary;

create or replace function public.set_primary_property_image(p_image_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  target_property_id uuid;
begin
  if not (select public.is_property_admin()) then
    raise exception 'Acesso administrativo necessário.';
  end if;

  select property_id into target_property_id
  from public.property_images
  where id = p_image_id;

  if target_property_id is null then
    raise exception 'Fotografia não encontrada.';
  end if;

  update public.property_images
  set is_primary = false
  where property_id = target_property_id and is_primary;

  update public.property_images
  set is_primary = true
  where id = p_image_id;
end;
$$;

revoke all on function public.set_primary_property_image(uuid) from public;
grant execute on function public.set_primary_property_image(uuid) to authenticated;

create or replace function public.select_replacement_primary_property_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_primary then
    update public.property_images
    set is_primary = true
    where id = (
      select id
      from public.property_images
      where property_id = old.property_id
      order by display_order, created_at, id
      limit 1
    );
  end if;
  return old;
end;
$$;

drop trigger if exists replace_primary_property_image_after_delete on public.property_images;
create trigger replace_primary_property_image_after_delete
  after delete on public.property_images
  for each row execute function public.select_replacement_primary_property_image();
