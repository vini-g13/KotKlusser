create table public.contractor_property_links (
  contractor_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contractor_id, property_id)
);

alter table public.contractor_property_links enable row level security;
