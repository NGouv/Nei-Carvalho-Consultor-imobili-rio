create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  reference text unique,
  property_type text not null,
  purpose text not null check (purpose in ('sale', 'rent')),
  price numeric(14, 2) not null check (price > 0),
  condominium numeric(14, 2) check (condominium is null or condominium >= 0),
  iptu numeric(14, 2) check (iptu is null or iptu >= 0),
  city text not null,
  neighborhood text not null,
  address text,
  cep text,
  bedrooms integer not null default 0 check (bedrooms >= 0),
  suites integer not null default 0 check (suites >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  parking integer not null default 0 check (parking >= 0),
  featured boolean not null default false,
  total_area numeric(12, 2) check (total_area is null or total_area >= 0),
  built_area numeric(12, 2) check (built_area is null or built_area >= 0),
  description text not null default '',
  features text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '',
  display_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists properties_status_created_at_idx
  on public.properties (status, created_at desc);
create index if not exists property_images_property_order_idx
  on public.property_images (property_id, display_order);
create unique index if not exists property_images_one_primary_per_property_idx
  on public.property_images (property_id)
  where is_primary;

grant select on public.admin_users to authenticated;
grant select on public.properties, public.property_images to anon, authenticated;
grant insert, update, delete on public.properties, public.property_images to authenticated;

create or replace function public.set_property_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_properties_updated_at on public.properties;
create trigger set_properties_updated_at
  before update on public.properties
  for each row execute function public.set_property_updated_at();

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

create or replace function public.is_property_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_property_admin() from public;
grant execute on function public.is_property_admin() to anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;

drop policy if exists "Admins can verify their own access" on public.admin_users;
create policy "Admins can verify their own access"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Published properties are public" on public.properties;
create policy "Published properties are public"
  on public.properties for select to anon, authenticated
  using (status = 'published' or (select public.is_property_admin()));

drop policy if exists "Admins can insert properties" on public.properties;
create policy "Admins can insert properties"
  on public.properties for insert to authenticated
  with check ((select public.is_property_admin()));

drop policy if exists "Admins can update properties" on public.properties;
create policy "Admins can update properties"
  on public.properties for update to authenticated
  using ((select public.is_property_admin()))
  with check ((select public.is_property_admin()));

drop policy if exists "Admins can delete properties" on public.properties;
create policy "Admins can delete properties"
  on public.properties for delete to authenticated
  using ((select public.is_property_admin()));

drop policy if exists "Published property images are public" on public.property_images;
create policy "Published property images are public"
  on public.property_images for select to anon, authenticated
  using (
    exists (
      select 1
      from public.properties
      where properties.id = property_images.property_id
        and properties.status = 'published'
    )
    or (select public.is_property_admin())
  );

drop policy if exists "Admins can insert property images" on public.property_images;
create policy "Admins can insert property images"
  on public.property_images for insert to authenticated
  with check ((select public.is_property_admin()));

drop policy if exists "Admins can update property images" on public.property_images;
create policy "Admins can update property images"
  on public.property_images for update to authenticated
  using ((select public.is_property_admin()))
  with check ((select public.is_property_admin()));

drop policy if exists "Admins can delete property images" on public.property_images;
create policy "Admins can delete property images"
  on public.property_images for delete to authenticated
  using ((select public.is_property_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-photos',
  'property-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Published property photos are readable" on storage.objects;
create policy "Published property photos are readable"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'property-photos'
    and (
      (select public.is_property_admin())
      or exists (
        select 1
        from public.property_images
        join public.properties on properties.id = property_images.property_id
        where property_images.storage_path = storage.objects.name
          and properties.status = 'published'
      )
    )
  );

drop policy if exists "Admins can upload property photos" on storage.objects;
create policy "Admins can upload property photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-photos'
    and (select public.is_property_admin())
  );

drop policy if exists "Admins can update property photos" on storage.objects;
create policy "Admins can update property photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-photos'
    and (select public.is_property_admin())
  )
  with check (
    bucket_id = 'property-photos'
    and (select public.is_property_admin())
  );

drop policy if exists "Admins can delete property photos" on storage.objects;
create policy "Admins can delete property photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-photos'
    and (select public.is_property_admin())
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'properties'
  ) then
    alter publication supabase_realtime add table public.properties;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'property_images'
  ) then
    alter publication supabase_realtime add table public.property_images;
  end if;
end
$$;
