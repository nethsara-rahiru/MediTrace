-- Run once in the Supabase SQL Editor. Do not disable row-level security.
begin;
create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  product jsonb not null check (jsonb_typeof(product) = 'object'),
  status text not null default 'draft' check (status in ('draft','approved','withdrawn')),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or (
    length(trim(coalesce(product->>'name',''))) > 0
    and length(trim(coalesce(product->>'source',''))) > 0
    and coalesce(product->>'verification','') = 'source_checked'
    and length(trim(coalesce(product->>'verified_at',''))) > 0
  ))
);
create index catalog_products_status on public.catalog_products(status,id);
create function public.touch_catalog_product() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger catalog_products_updated before update on public.catalog_products
for each row execute function public.touch_catalog_product();
alter table public.catalog_products enable row level security;
revoke all on public.catalog_products from anon, authenticated;
grant select on public.catalog_products to anon, authenticated;
create policy "Read reviewed catalog and withdrawal notices"
on public.catalog_products for select to anon, authenticated
using (status in ('approved','withdrawn'));
comment on table public.catalog_products is
'Public medicine reference only. Review sources and identifiers before approval. Withdraw rather than delete published rows. Never store personal records here.';
commit;
