-- Run after 001_shared_catalog.sql. No account or approval is required to publish.
begin;
alter table public.catalog_products drop constraint catalog_products_status_check;
alter table public.catalog_products add constraint catalog_products_status_check
check (status in ('draft','approved','withdrawn','community'));
drop policy "Read reviewed catalog and withdrawal notices" on public.catalog_products;
create policy "Read shared products and withdrawal notices"
on public.catalog_products for select to anon, authenticated
using (status in ('approved','withdrawn','community'));

-- These tables never expose a device's write capability or permit direct writes.
create table public.catalog_write_keys (
 product_id uuid primary key references public.catalog_products(id) on delete cascade,
 token_hash text not null
);
create table public.catalog_identifiers (
 identifier text primary key,
 product_id uuid not null references public.catalog_products(id) on delete cascade
);
create index catalog_identifiers_product on public.catalog_identifiers(product_id);
alter table public.catalog_write_keys enable row level security;
alter table public.catalog_identifiers enable row level security;
revoke all on public.catalog_write_keys, public.catalog_identifiers from public, anon, authenticated;

create function public.catalog_normalize_identifier(value text) returns text
language plpgsql immutable set search_path = '' as $$
declare n integer; total integer := 0; i integer; weight integer := 3;
begin
 value := trim(value); n := length(value);
 if value ~ '^[0-9]+$' and n in (8,12,13,14) then
  for i in reverse n-1..1 loop
   total := total + substring(value,i,1)::integer * weight;
   weight := 4-weight;
  end loop;
  if ((10-(total % 10)) % 10) = right(value,1)::integer then
   return lpad(value,14,'0');
  end if;
 end if;
 return value;
end;
$$;
create function public.index_catalog_identifiers() returns trigger
language plpgsql security definer set search_path = '' as $$
declare code jsonb; normalized text;
begin
 delete from public.catalog_identifiers where product_id = new.id;
 if new.status in ('approved','community') then
  if coalesce(jsonb_typeof(new.product->'barcodes'),'') <> 'array' then
   raise exception 'Product barcodes must be an array';
  end if;
  for code in select value from jsonb_array_elements(new.product->'barcodes') loop
   if jsonb_typeof(code) <> 'string' then raise exception 'Invalid product barcode'; end if;
   normalized := public.catalog_normalize_identifier(code #>> '{}');
   if length(normalized) < 1 or length(normalized) > 256 or normalized ~ '[[:space:][:cntrl:]]' or normalized ~* '^https?:' then
    raise exception 'Invalid product barcode';
   end if;
   insert into public.catalog_identifiers(identifier,product_id) values (normalized,new.id)
   on conflict(identifier) do update set product_id=excluded.product_id
   where public.catalog_identifiers.product_id=excluded.product_id;
   if not found then raise exception 'This barcode is already associated with another shared product'; end if;
  end loop;
 end if;
 return new;
end;
$$;
create trigger catalog_identifier_index after insert or update of product,status
on public.catalog_products for each row execute function public.index_catalog_identifiers();
-- Index existing published records too; conflicting records cause an atomic failure.
update public.catalog_products set product=product where status='approved';

create function public.publish_catalog_product(p_id uuid, p_write_token text, p_product jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
 clean jsonb; k text; val jsonb; item jsonb; existing_status text;
 expected_hash text;
 allowed text[] := array['name','generic_name','strength','dosage_form','manufacturer','manufacturer_address','country','category','pack_size','storage','warnings','indications','prescription','source','verification','verified_at','ingredients','barcodes'];
begin
 if p_id is null or p_write_token is null or p_write_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid publication credentials'; end if;
 if p_product is null or jsonb_typeof(p_product)<>'object' or octet_length(p_product::text)>65536 then raise exception 'Invalid product payload'; end if;
 for k,val in select key,value from jsonb_each(p_product) loop
  if not k=any(allowed) then raise exception 'Unexpected product field'; end if;
  if k not in ('verification','verified_at','ingredients','barcodes') then
   if jsonb_typeof(val)<>'string' or length(val #>> '{}')>4096 then raise exception 'Invalid product text'; end if;
  end if;
 end loop;
 if coalesce(length(trim(p_product->>'name')),0) not between 1 and 160 or coalesce(length(trim(p_product->>'source')),0)<1 then raise exception 'Product name and information source are required'; end if;
 if coalesce(jsonb_typeof(p_product->'ingredients'),'')<>'array' or coalesce(jsonb_typeof(p_product->'barcodes'),'')<>'array' then raise exception 'Ingredients and barcodes must be arrays'; end if;
 if jsonb_array_length(p_product->'ingredients')>50 or jsonb_array_length(p_product->'barcodes')>50 then raise exception 'Too many ingredients or barcodes'; end if;
 for item in select value from jsonb_array_elements(p_product->'ingredients') loop
  if jsonb_typeof(item)<>'object' or coalesce(jsonb_typeof(item->'name'),'')<>'string' or coalesce(length(trim(item->>'name')),0) not between 1 and 160 or coalesce(jsonb_typeof(item->'strength'),'')<>'string' or length(item->>'strength')>160 or (item - array['name','strength']) <> '{}'::jsonb then raise exception 'Invalid ingredient'; end if;
 end loop;
 -- Public writes can never claim independent source verification.
 clean := p_product || jsonb_build_object('verification','user_entered','verified_at',null);
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select status into existing_status from public.catalog_products where id=p_id for update;
 if found then
  select token_hash into expected_hash from public.catalog_write_keys where product_id=p_id;
  if expected_hash is null or expected_hash<>encode(sha256(convert_to(p_write_token,'UTF8')),'hex') then raise exception 'This device cannot edit that shared product'; end if;
  if existing_status<>'community' then raise exception 'Reviewed or withdrawn products cannot be changed by public submissions'; end if;
  update public.catalog_products set product=clean where id=p_id;
 else
  insert into public.catalog_products(id,product,status) values(p_id,clean,'community');
  insert into public.catalog_write_keys(product_id,token_hash)
  values(p_id,encode(sha256(convert_to(p_write_token,'UTF8')),'hex'));
 end if;
 return p_id;
end;
$$;
revoke all on function public.publish_catalog_product(uuid,text,jsonb) from public;
grant execute on function public.publish_catalog_product(uuid,text,jsonb) to anon, authenticated;
-- Direct table writes remain denied. Only the bounded publication function is callable.
notify pgrst, 'reload schema';
commit;
