'use strict';
// Shared DB helper for GitHub Action fetch scripts.
// Provides: ensureSchema(), upsertCache(), readCache(), checksum()

const { Client } = require('pg');
const crypto = require('crypto');

// ── Schema (idempotent) ───────────────────────────────────────
const SCHEMA_SQL = `
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
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'app_cache' and policyname = 'read_app_cache'
  ) then
    execute 'create policy "read_app_cache" on app_cache for select using (true)';
  end if;
end $$;
`;

async function ensureSchema() {
  if (!process.env.SUPABASE_DB_URL) {
    console.log('  SUPABASE_DB_URL not set — skipping schema check (table must exist)');
    return;
  }
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(SCHEMA_SQL);
    console.log('  Schema verified');
  } finally {
    await client.end();
  }
}

// ── Checksum ──────────────────────────────────────────────────
function checksum(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

// ── REST helpers ──────────────────────────────────────────────
function sbHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
}

function sbUrl(path) {
  return (process.env.SUPABASE_URL || '').replace(/\/+$/, '') + path;
}

async function readCache(key) {
  const r = await fetch(sbUrl(`/rest/v1/app_cache?key=eq.${encodeURIComponent(key)}&select=checksum,record_count,fetched_at`), {
    headers: sbHeaders(),
  });
  if (!r.ok) throw new Error(`readCache HTTP ${r.status}`);
  const rows = await r.json();
  return rows[0] || null;
}

// Upsert key→data. Returns true if content changed, false if unchanged.
async function upsertCache(key, data, { source, fetchedAt } = {}) {
  const now = new Date().toISOString();
  const ft  = fetchedAt || now;
  const cs  = checksum(data);
  const count = Array.isArray(data) ? data.length : null;

  const current = await readCache(key);

  if (current?.checksum === cs) {
    // Unchanged — just refresh fetched_at so frontend staleness check stays quiet
    const r = await fetch(sbUrl(`/rest/v1/app_cache?key=eq.${encodeURIComponent(key)}`), {
      method: 'PATCH',
      headers: sbHeaders({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ fetched_at: ft }),
    });
    if (!r.ok) throw new Error(`PATCH fetched_at HTTP ${r.status}`);
    console.log(`  [${key}] no change (${current.record_count ?? '?'} records) — refreshed fetched_at`);
    return false;
  }

  const r = await fetch(sbUrl('/rest/v1/app_cache'), {
    method: 'POST',
    headers: sbHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ key, data, record_count: count, checksum: cs, source: source || null, fetched_at: ft, updated_at: now }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`upsert HTTP ${r.status}: ${body.slice(0, 200)}`);
  }

  const prev = current?.record_count;
  const delta = prev != null ? ` (${prev} → ${count ?? '?'})` : ` (${count ?? '?'} records, first write)`;
  console.log(`  [${key}] updated${delta}`);
  return true;
}

module.exports = { ensureSchema, upsertCache, readCache, checksum };
