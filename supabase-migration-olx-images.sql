alter table public.property_images
  add column if not exists olx_storage_path text,
  add column if not exists olx_ready boolean not null default false;

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
        where (
            property_images.storage_path = storage.objects.name
            or property_images.olx_storage_path = storage.objects.name
          )
          and properties.status = 'published'
      )
    )
  );
