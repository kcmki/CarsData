-- Supabase/Postgres schema for the collector

create table if not exists public.ads (
  unique_key text primary key,
  list_id bigint,
  url text,
  subject text,
  body text,
  category_id text,
  category_name text,
  ad_type text,
  status text,
  price_cents bigint,
  price numeric,
  first_publication_date bigint,
  expiration_date bigint,
  index_date bigint,
  has_phone boolean,
  -- images
  images_nb int,
  images_thumb_url text,
  images_small_url text,
  images_urls jsonb,
  images_urls_thumb jsonb,
  images_urls_large jsonb,
  -- location
  location_country_id text,
  location_region_id text,
  location_region_name text,
  location_department_id text,
  location_department_name text,
  location_city text,
  location_zipcode text,
  location_lat double precision,
  location_lng double precision,
  -- owner
  owner_store_id text,
  owner_user_id text,
  owner_type text,
  owner_name text,
  -- attributes main
  car_brand text,
  car_model text,
  regdate text,
  mileage int,
  fuel_label text,
  gearbox_label text,
  doors int,
  seats int,
  issuance_date text,
  vehicle_type text,
  vehicule_color text,
  critair int,
  horsepower_fiscal int,
  horsepower_din int,
  -- raw payload for reference
  raw jsonb,
  first_seen_at bigint,
  updated_at bigint
);

create table if not exists public.runs (
  id bigserial primary key,
  started_at bigint,
  finished_at bigint,
  attempts int,
  success boolean,
  count_scraped int,
  stats jsonb,
  error text
);

-- Recommended RLS policies (adjust as needed). Disable RLS for simplicity or set proper policies.
-- alter table public.ads enable row level security;
-- alter table public.runs enable row level security;
-- create policy "Allow all for service role" on public.ads for all using (true) with check (true);
-- create policy "Allow all for service role" on public.runs for all using (true) with check (true);
