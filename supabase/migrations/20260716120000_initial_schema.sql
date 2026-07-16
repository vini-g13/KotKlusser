-- KotKlusser — initieel Postgres-schema voor de Supabase-migratie
-- Cleanup sprint 5 (kotklusser-cleanup-plan.md sectie 6.1)
--
-- Ontwerpkeuzes, kort:
--  1. Tabel-, kolomnamen ÉN opgeslagen enum-waarden zijn overal Engels (herzien
--     na overleg): niet enkel verhuurder_id -> landlord_id / naam -> name /
--     specialiteit -> specialty / regio -> region, maar ook de statuswaarden
--     zelf (verstuurd/ontvangen/in_behandeling/opgelost -> sent/received/
--     in_progress/resolved), urgentie (laag/normaal/hoog -> low/normal/high;
--     "urgent" bleef al zo) en de rol "aannemer" -> "contractor". Reden: dit is
--     geen cosmetische keuze meer zodra KotKlusser ooit een Engelstalige UI
--     krijgt (bv. voor exchange-studenten) — dan moet de data zelf ook al
--     taalneutraal zijn, anders vertaal je de UI-laag maar de onderliggende
--     waarden blijven Nederlands. Zichtbare Nederlandse tekst (labels, e-mails)
--     blijft uiteraard gewoon Nederlands; het gaat hier enkel over de interne,
--     opgeslagen tokens. Deze rename raakt ook een bestaande inconsistentie:
--     de aannemer-pagina's gebruikten "kritiek" als hoogste urgentietier waar
--     de rest van de app "urgent" gebruikt voor hetzelfde concept — hier
--     samengevoegd tot één waarde ("urgent").
--  2. auth.users (Supabase Auth) vervangt de custom users-collectie voor identiteit
--     + wachtwoord. "profiles" bevat enkel de KotKlusser-specifieke velden.
--  3. Denormalisatie die in Mongo nodig was (property_name, created_by_name,
--     aannemer_naam, sender_name, ...) is hier weggelaten — dat lost een gewone
--     Postgres-join op, geen reden om het te bewaren.
--  4. Ticketfoto's gaan naar Supabase Storage (storage_path) in plaats van
--     base64-blobs embedded in de rij — zie cleanup-plan sectie 2 (N+1/document-
--     grootte-risico).
--  5. verhuurder_ids (array op de user) wordt een echte jointabel
--     (contractor_landlord_links) — een array is geen bruikbare relatie in SQL.
--  6. refresh_tokens bestaat niet meer — Supabase Auth beheert sessies/refresh
--     tokens zelf.
--  7. RLS staat aan op elke tabel, maar er zijn (bewust) nog geen granulaire
--     policies per rol. De FastAPI-backend praat met Postgres via de
--     service_role-key, die RLS altijd omzeilt — dezelfde autorisatie-aanpak als
--     vandaag (Python-code controleert user['role'], niet de database). Dit is
--     bewust: tegelijk het datamodel EN het autorisatiemodel herontwerpen is
--     precies de val die kotstart-platform-overzicht-bijgewerkt.md als "Zorg 1"
--     benoemt. Granulaire RLS-policies (voor als de frontend ooit rechtstreeks
--     met Supabase praat i.p.v. via de backend) zijn bewust uitgesteld.

-- ============ PROFILES ============
-- Vult auth.users aan met KotKlusser-specifieke velden.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'landlord', 'contractor')),
  name text not null,
  phone text,
  company_name text,                          -- enkel relevant voor landlord
  property_id uuid,                           -- FK toegevoegd na properties-tabel (zie onder)
  room_number text,
  floor text,
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'pro')),
  billing text default 'monthly' check (billing in ('monthly', 'yearly')),
  subscription_status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  specialty text,                              -- enkel relevant voor contractor
  region text,                                 -- enkel relevant voor contractor
  tile_config jsonb,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'KotKlusser-specifieke velden per gebruiker; identiteit/wachtwoord zit in auth.users.';

-- ============ PROPERTIES ============

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  join_code text not null unique,
  floor_count int not null default 5,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_property_id_fkey
  foreign key (property_id) references public.properties(id) on delete set null;

create index profiles_property_id_idx on public.profiles(property_id);
create index profiles_role_idx on public.profiles(role);
create index properties_landlord_id_idx on public.properties(landlord_id);

-- ============ CONTRACTOR <-> LANDLORD LINKS ============
-- Vervangt het "verhuurder_ids"-array-veld op de user (many-to-many, geen array).

create table public.contractor_landlord_links (
  contractor_id uuid not null references auth.users(id) on delete cascade,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contractor_id, landlord_id)
);

-- ============ TICKETS ============

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  title text not null,
  description text not null,
  category text not null,
  location text not null,
  urgency text not null default 'normal'
    check (urgency in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'sent'
    check (status in ('sent', 'received', 'in_progress', 'resolved')),
  created_by uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  contractor_id uuid references auth.users(id) on delete set null,
  contractor_assigned_at timestamptz,
  estimated_repair_date timestamptz,
  scheduled_date timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_landlord_response timestamptz,
  last_reminder_sent timestamptz,
  last_student_read timestamptz,
  last_landlord_read timestamptz,
  last_status_change timestamptz
);

create index tickets_created_by_idx on public.tickets(created_by);
create index tickets_property_id_idx on public.tickets(property_id);
create index tickets_contractor_id_idx on public.tickets(contractor_id);
create index tickets_status_idx on public.tickets(status);

-- Houdt updated_at automatisch bij, zodat de backend dat niet overal handmatig
-- hoeft te zetten (in server.py gebeurde dat tot nu toe bij elke update_one).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- ============ TICKET PHOTOS ============
-- Vervangt de embedded base64 "photos"-array; storage_path verwijst naar een
-- object in Supabase Storage (bucket bv. "ticket-photos").

create table public.ticket_photos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ticket_photos_ticket_id_idx on public.ticket_photos(ticket_id);

-- ============ MESSAGES ============

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  is_reminder boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_ticket_id_idx on public.messages(ticket_id);

-- ============ CONTRACTOR INVITES ============
-- Vervangt "aannemer_invites".

create table public.contractor_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  specialty text,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index contractor_invites_landlord_id_idx on public.contractor_invites(landlord_id);
create index contractor_invites_email_idx on public.contractor_invites(email);

-- ============ EMAIL CHANGE REQUESTS (student, landlord keurt goed) ============

create table public.email_change_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  new_email text not null,
  property_id uuid references public.properties(id) on delete set null,
  landlord_id uuid references auth.users(id) on delete set null,
  approval_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  rejection_reason text
);

create index email_change_requests_student_id_idx on public.email_change_requests(student_id);
create index email_change_requests_landlord_id_idx on public.email_change_requests(landlord_id);
create index email_change_requests_status_idx on public.email_change_requests(status);

-- ============ LANDLORD EMAIL CHANGES (self-service, bevestiging via nieuw adres) ============

create table public.landlord_email_changes (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  old_email text not null,
  new_email text not null,
  confirmation_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  expires_at timestamptz not null
);

create index landlord_email_changes_landlord_id_idx on public.landlord_email_changes(landlord_id);
create index landlord_email_changes_status_idx on public.landlord_email_changes(status);

-- ============ CONTACT / DEMO SIGNUPS ============

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('contact', 'demo_signup')),
  name text not null,
  company text,
  email text not null,
  phone text,
  message text,
  created_at timestamptz not null default now(),
  follow_up_sent boolean not null default false,
  follow_up_scheduled_at timestamptz,
  follow_up_sent_at timestamptz
);

create index contact_submissions_type_idx on public.contact_submissions(type);
create index contact_submissions_follow_up_idx on public.contact_submissions(follow_up_sent, follow_up_scheduled_at);

-- ============ ROW LEVEL SECURITY ============
-- Aan op elke tabel (Supabase-best practice + vereist voor de linter). Geen
-- policies voor anon/authenticated toegevoegd in dit eerste schema — zie de
-- toelichting bovenaan dit bestand. service_role (de backend) omzeilt RLS
-- sowieso en blijft de enige weg naar deze tabellen tot de frontend ooit
-- rechtstreeks met Supabase praat.

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.contractor_landlord_links enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_photos enable row level security;
alter table public.messages enable row level security;
alter table public.contractor_invites enable row level security;
alter table public.email_change_requests enable row level security;
alter table public.landlord_email_changes enable row level security;
alter table public.contact_submissions enable row level security;
