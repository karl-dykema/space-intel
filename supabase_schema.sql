-- Space Vessel Intelligence — Supabase Schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New query
-- ──────────────────────────────────────────────────────────────

-- Vessel position history
create table if not exists positions (
  id         bigserial    primary key,
  mmsi       text         not null,
  lat        float8       not null,
  lon        float8       not null,
  sog        float4,
  cog        float4,
  ts         timestamptz  not null default now()
);
create index if not exists positions_mmsi_ts on positions (mmsi, ts desc);

-- Aircraft position history (ADS-B, written by admin, read by share page)
create table if not exists aircraft_positions (
  id     bigserial   primary key,
  reg    text        not null,
  lat    float8      not null,
  lon    float8      not null,
  alt    float4,
  gs     float4,
  track  float4,
  ts     timestamptz not null default now()
);
create index if not exists aircraft_positions_reg_ts on aircraft_positions (reg, ts desc);

-- Events: zone entries/exits, underway, moored, AIS gaps, destination changes
create table if not exists events (
  id          bigserial    primary key,
  mmsi        text         not null,
  vessel_name text,
  operator    text,
  type        text         not null,
  detail      text,
  lat         float8,
  lon         float8,
  ts          timestamptz  not null default now()
);
create index if not exists events_ts     on events (ts desc);
create index if not exists events_mmsi   on events (mmsi, ts desc);

-- News articles fetched via Google News RSS
create table if not exists news_articles (
  id           bigserial    primary key,
  mmsi         text,
  vessel_name  text,
  title        text         not null,
  link         text,
  description  text,
  published_at timestamptz,
  fetched_at   timestamptz  not null default now()
);
create index if not exists news_fetched on news_articles (fetched_at desc);

-- Crowd-sourced vessel suggestions (from share-mode viewers)
create table if not exists suggestions (
  id          bigserial    primary key,
  ts          timestamptz  not null default now(),
  type        text         not null,
  vessel_name text,
  mmsi        text,
  notes       text,
  contact     text,
  status      text         not null default 'pending'
);
create index if not exists suggestions_ts on suggestions (ts desc);

-- ── Row Level Security ────────────────────────────────────────
-- Anon key can read + insert, but NOT update or delete.
-- Safe for a personal project with a public-facing anon key.

alter table positions          enable row level security;
alter table aircraft_positions enable row level security;
alter table events             enable row level security;
alter table news_articles      enable row level security;

create policy "read_positions"   on positions          for select using (true);
create policy "write_positions"  on positions          for insert with check (true);

create policy "read_ac_pos"      on aircraft_positions for select using (true);
create policy "write_ac_pos"     on aircraft_positions for insert with check (true);

create policy "read_events"     on events        for select using (true);
create policy "write_events"    on events        for insert with check (true);

create policy "read_news"       on news_articles for select using (true);
create policy "write_news"      on news_articles for insert with check (true);

alter table suggestions enable row level security;
create policy "read_suggestions"   on suggestions for select using (true);
create policy "write_suggestions"  on suggestions for insert with check (true);
create policy "delete_suggestions" on suggestions for delete using (true);

-- General app cache — written by GitHub Actions (service key), read by all
-- Keys: 'launches.upcoming', 'closures.bocachica', etc.
create table if not exists app_cache (
  key          text         primary key,
  data         jsonb        not null,
  record_count integer,
  checksum     text,
  source       text,
  fetched_at   timestamptz  not null,
  updated_at   timestamptz  not null default now()
);
alter table app_cache enable row level security;
create policy "read_app_cache" on app_cache for select using (true);
-- Writes use service_role key (GitHub Actions); no anon insert policy needed.
