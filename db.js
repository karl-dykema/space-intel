'use strict';

// Tab leader election — only one tab writes positions to Supabase at a time.
// Leader renews its claim every 5s. If claim goes stale (>15s), any tab can take over.
const _TAB_ID = Math.random().toString(36).slice(2);
const _LEADER_KEY = 'sft_leader';
const _LEADER_TS  = 'sft_leader_ts';

function _claimLeader() {
  localStorage.setItem(_LEADER_KEY, _TAB_ID);
  localStorage.setItem(_LEADER_TS,  Date.now().toString());
}
function _isLeader() {
  const owner = localStorage.getItem(_LEADER_KEY);
  const ts    = parseInt(localStorage.getItem(_LEADER_TS) || '0');
  if (owner === _TAB_ID) return true;
  if (Date.now() - ts > 15000) { _claimLeader(); return true; } // stale — take over
  return false;
}
setInterval(() => { if (localStorage.getItem(_LEADER_KEY) === _TAB_ID) _claimLeader(); }, 5000);

const SB = {
  url:   null,
  akey:  null,
  ready: false,

  init() {
    this.url  = (localStorage.getItem(LS.SB_URL)  || CFG_SB_URL  || '').replace(/\/+$/,'');
    this.akey =  localStorage.getItem(LS.SB_AKEY) || CFG_SB_AKEY || '';
    this.ready = !!(this.url && this.akey && !this.url.includes('YOUR_PROJECT'));
    updateSBStatus();
    return this.ready;
  },

  _h(extra) {
    return { 'apikey':this.akey, 'Authorization':`Bearer ${this.akey}`,
             'Content-Type':'application/json', ...extra };
  },

  async insert(table, row) {
    if(!this.ready) return;
    try {
      await fetch(`${this.url}/rest/v1/${table}`, {
        method:'POST', headers:this._h({'Prefer':'return=minimal'}), body:JSON.stringify(row),
      });
      const info = table==='positions'?` ${VESSEL_DB[row.mmsi]?.abbr||row.mmsi} → ${row.lat?.toFixed(3)},${row.lon?.toFixed(3)}`
                 : table==='events'   ?` [${row.type}] ${row.vessel_name||row.mmsi}`
                 : ` ${row.vessel_name||''} "${(row.title||'').slice(0,40)}"`;
      addLog(`DB ← ${table}${info}`, 'db');
    } catch(e) { console.warn(`[sb] insert ${table}:`,e.message); addLog(`DB ERR insert ${table}: ${e.message}`, 'err'); }
  },

  async select(table, params) {
    if(!this.ready) return null;
    try {
      const qs = Object.entries(params||{})
        .map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      const r = await fetch(`${this.url}/rest/v1/${table}${qs?'?'+qs:''}`, { headers:this._h({}) });
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      addLog(`DB → ${table} — ${data?.length??0} rows`, 'db');
      return data;
    } catch(e) { console.warn(`[sb] select ${table}:`,e.message); addLog(`DB ERR select ${table}: ${e.message}`, 'err'); return null; }
  },
};

// Hold display position if new reading is within ~55m and SOG ≤ 0.5 kn (suppress GPS dock noise)
function smoothPos(prevLat, prevLon, rawLat, rawLon, sog) {
  if (!prevLat || sog > 0.5) return [rawLat, rawLon];
  const dlat = Math.abs(rawLat - prevLat), dlon = Math.abs(rawLon - prevLon);
  return (dlat < 0.0005 && dlon < 0.0005) ? [prevLat, prevLon] : [rawLat, rawLon];
}

const sbLastPos = {};
function maybeSBPos(mmsi, lat, lon, sog, cog, ts) {
  if(!SB.ready || !_isLeader()) return;
  const moving = sog != null && sog > 0.5;
  const throttle = moving ? 15000 : 90000;
  if(sbLastPos[mmsi] && ts-sbLastPos[mmsi] < throttle) return;
  sbLastPos[mmsi] = ts;
  SB.insert('positions', { mmsi, lat, lon, sog, cog, ts:new Date(ts).toISOString() });
}

const sbLastAcPos = {};
function maybeSBAcPos(reg, lat, lon, alt, gs, track, ts) {
  if(!SB.ready || SHARE_MODE || !_isLeader()) return;
  if(sbLastAcPos[reg] && ts - sbLastAcPos[reg] < 30000) return;
  sbLastAcPos[reg] = ts;
  SB.insert('aircraft_positions', { reg, lat, lon, alt: alt ?? null, gs: gs ?? null, track: track ?? null, ts: new Date(ts).toISOString() });
}

function sbWriteEvent(ev) {
  if(!SB.ready || !_isLeader()) return;
  SB.insert('events', {
    mmsi:ev.mmsi, vessel_name:ev.name, operator:ev.operator,
    type:ev.type, detail:ev.detail, lat:ev.lat, lon:ev.lon,
    ts:new Date(ev.ts).toISOString(),
  });
}

async function loadSBData() {
  if(!SB.init()) { addLog('Supabase not configured — enter URL + key in ⚙ SETTINGS', 'sys'); return; }
  addLog('Supabase: loading history…', 'db');

  const since7  = new Date(Date.now()-7*86400000).toISOString();
  const sbEvs = await SB.select('events', { ts:`gte.${since7}`, order:'ts.desc', limit:'500' });
  if(sbEvs?.length) {
    sbEvs.forEach(e => {
      const ts = new Date(e.ts).getTime();
      if(events.some(ev=>Math.abs(ev.ts-ts)<2000&&ev.mmsi===e.mmsi&&ev.type===e.type)) return;
      const cfg=EV_CFG[e.type]||{icon:'·',color:'#888'};
      const info=VESSEL_DB[e.mmsi]||{};
      events.push({ ts, mmsi:e.mmsi,
        name:e.vessel_name||info.name||e.mmsi, abbr:info.abbr||e.vessel_name||e.mmsi,
        operator:e.operator||info.operator||'', opColor:opColor(e.operator||info.operator),
        type:e.type, icon:cfg.icon, typeColor:cfg.color,
        detail:e.detail||'', lat:e.lat, lon:e.lon,
      });
    });
    events.sort((a,b)=>b.ts-a.ts);
    addLog(`Supabase: loaded ${sbEvs.length} events (last 7 days)`, 'db');
    if(S.tab==='events'||S.tab==='history') renderRight();
  }

  const _sinceHistoric = new Date(Date.now()-3*86400000).toISOString(); // 3 days, newest first — avoids returning ancient rows before recent ones
  const _sinceLive     = new Date(Date.now()-2*3600000).toISOString();
  const _isFirstLoad   = !window._sbLoaded;
  window._sbLoaded     = true;
  const allRows = await SB.select('positions', {
    mmsi: `in.(${KNOWN_MMSIS.join(',')})`,
    ts: `gte.${_isFirstLoad ? _sinceHistoric : _sinceLive}`,
    order: 'ts.desc', limit: '20000',
    select: 'mmsi,lat,lon,ts,sog,cog',
  });
  if(allRows?.length) {
    const byMmsi = {};
    allRows.forEach(r => { (byMmsi[r.mmsi] = byMmsi[r.mmsi]||[]).push(r); });
    for(const [mmsi, rows] of Object.entries(byMmsi)) {
      if(!VESSEL_DB[mmsi]) continue;
      rows.reverse(); // desc → asc for chronological track rendering
      const pos = rows.map(r=>({lat:r.lat,lon:r.lon,ts:new Date(r.ts).getTime(),sog:r.sog,cog:r.cog}));
      if(!history[mmsi]) history[mmsi]={positions:[],firstSeen:pos[0].ts,lastSeen:pos[pos.length-1].ts};
      const existing = new Set(history[mmsi].positions.map(p=>Math.floor(p.ts/60000)));
      pos.forEach(p=>{ if(!existing.has(Math.floor(p.ts/60000))) history[mmsi].positions.push(p); });
      history[mmsi].positions.sort((a,b)=>a.ts-b.ts);
      history[mmsi].firstSeen = history[mmsi].positions[0].ts;
      history[mmsi].lastSeen  = history[mmsi].positions[history[mmsi].positions.length-1].ts;
      const last = history[mmsi].positions[history[mmsi].positions.length-1];
      const dbTrack = history[mmsi].positions.map(p=>[p.lat,p.lon]);
      if(!S.vessels[mmsi]) {
        // Vessel not yet seen — create from DB history
        S.vessels[mmsi] = { mmsi, ...VESSEL_DB[mmsi], lat:last.lat, lon:last.lon, sog:last.sog||0, cog:last.cog||0, ts:last.ts, track:dbTrack, _historical:true };
      } else {
        // Vessel already exists (live AIS) — always prepend DB history to track so trail shows
        S.vessels[mmsi].track = [...dbTrack, ...S.vessels[mmsi].track].slice(-MAX_POS);
        // Only update position if DB is newer (share mode) or we have no position yet
        if(SHARE_MODE || last.ts > (S.vessels[mmsi].ts||0) || S.vessels[mmsi]._vapi) {
          S.vessels[mmsi].lat = last.lat; S.vessels[mmsi].lon = last.lon;
          S.vessels[mmsi].sog = last.sog||0; S.vessels[mmsi].cog = last.cog||0;
          S.vessels[mmsi].ts = last.ts; S.vessels[mmsi]._historical = true;
        }
      }
      updateMarker(S.vessels[mmsi]);
    }
  }

  const since3d = new Date(Date.now() - 3 * 86400000).toISOString();
  const acRows = await SB.select('aircraft_positions', {
    ts: `gte.${since3d}`, order: 'ts.asc', limit: '6000',
    select: 'reg,lat,lon,alt,gs,track,ts',
  });
  if (acRows?.length) {
    const byReg = {};
    acRows.forEach(r => { (byReg[r.reg] = byReg[r.reg] || []).push(r); });
    for (const [reg, rows] of Object.entries(byReg)) {
      if (!AIRCRAFT_DB[reg]) continue;
      // Split into segments at gaps > 4h — avoids long connector lines between flights
      const GAP_AC = 4 * 3600000;
      const segments = [];
      let cur = [];
      for (let i = 0; i < rows.length; i++) {
        if (i > 0 && new Date(rows[i].ts).getTime() - new Date(rows[i-1].ts).getTime() > GAP_AC) {
          if (cur.length) { segments.push(cur); cur = []; }
        }
        cur.push([rows[i].lat, rows[i].lon]);
      }
      if (cur.length) segments.push(cur);
      const pts = segments.length === 1 ? segments[0] : segments;
      const last = rows[rows.length - 1];
      const lastTs = new Date(last.ts).getTime();
      const existing = S.aircraft[reg];
      const freshness = Date.now() - lastTs;
      const isStale = freshness > 5 * 60000;
      // SHARE_MODE: always use Supabase (no live poll). Admin first load: apply if newer.
      if (SHARE_MODE || !existing || lastTs > (existing.ts || 0)) {
        S.aircraft[reg] = {
          ...(existing || {}),
          reg, lat: last.lat, lon: last.lon,
          alt: last.alt, gs: last.gs, track: last.track ?? 0,
          ts: lastTs, _stale: isStale, _staleTs: isStale ? lastTs : undefined,
          _track: pts,
        };
      }
      updateAircraftMarker(reg);
    }
    addLog(`Supabase: aircraft tracks loaded (${Object.keys(byReg).length} regs, ${acRows.length} pts)`, 'db');
  }

  addLog('Supabase: history load complete', 'db');
  renderFleet();
  updateHeaderStats();
  updateSBStatus();
}

function initSBRealtime() {
  if (!SB.ready) return;
  const wsUrl = SB.url.replace(/^https?/, 'wss') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(SB.akey) + '&vsn=1.0.0';
  let ws, hbTimer, ref = 0;

  function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      addLog('Realtime: connected', 'db');
      loadSBData();
      ws.send(JSON.stringify({
        topic: 'realtime:public:positions',
        event: 'phx_join',
        payload: { config: { broadcast:{ self:false }, presence:{ key:'' },
          postgres_changes: [{ event:'INSERT', schema:'public', table:'positions' }] } },
        ref: String(++ref),
      }));
      ws.send(JSON.stringify({
        topic: 'realtime:public:aircraft_positions',
        event: 'phx_join',
        payload: { config: { broadcast:{ self:false }, presence:{ key:'' },
          postgres_changes: [{ event:'INSERT', schema:'public', table:'aircraft_positions' }] } },
        ref: String(++ref),
      }));
      hbTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }));
      }, 25000);
    };

    ws.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.event !== 'postgres_changes') return;
        const rec = msg.payload?.data?.record || msg.payload?.data?.new;
        const tbl = msg.payload?.data?.table || (msg.topic||'').replace('realtime:public:','');
        if (!rec) return;

        if (tbl === 'aircraft_positions' && rec.reg) {
          const reg = rec.reg;
          if (!AIRCRAFT_DB[reg]) return;
          const ts = new Date(rec.ts).getTime();
          const ac = S.aircraft[reg];
          if (ac && ts <= (ac.ts || 0)) return;
          const freshness = Date.now() - ts;
          S.aircraft[reg] = {
            ...(ac || {}),
            reg, lat: rec.lat, lon: rec.lon,
            alt: rec.alt, gs: rec.gs, track: rec.track ?? 0,
            ts, _stale: freshness > 300000, _staleTs: freshness > 300000 ? ts : undefined,
            _track: [...((ac?._track)||[]), [rec.lat, rec.lon]].slice(-500),
          };
          updateAircraftMarker(reg);
          renderFleet();
          return;
        }

        if (!rec?.mmsi) return;
        const mmsi = String(rec.mmsi);
        if (!VESSEL_DB[mmsi]) return;
        const ts = new Date(rec.ts).getTime();
        if (!S.vessels[mmsi]) S.vessels[mmsi] = { mmsi, ...VESSEL_DB[mmsi] };
        const v = S.vessels[mmsi];
        if (ts <= (v.ts || 0)) return;
        v.sog = rec.sog ?? 0; v.cog = rec.cog ?? 0;
        [v.lat, v.lon] = smoothPos(v.lat, v.lon, rec.lat, rec.lon, v.sog);
        v.ts = ts; v._stale = false; v._historical = false;
        if (!history[mmsi]) history[mmsi] = { positions: [], firstSeen: ts, lastSeen: ts };
        history[mmsi].positions.push({ lat: rec.lat, lon: rec.lon, ts, sog: rec.sog, cog: rec.cog });
        history[mmsi].lastSeen = ts;
        v.track = history[mmsi].positions.map(p => [p.lat, p.lon]);
        updateMarker(v);
        renderFleet();
        addLog(`Realtime ← ${VESSEL_DB[mmsi]?.abbr || mmsi} ${rec.lat?.toFixed(3)},${rec.lon?.toFixed(3)}`, 'ais');
      } catch(e) {}
    };

    ws.onerror = () => addLog('Realtime: WebSocket error', 'err');

    ws.onclose = () => {
      clearInterval(hbTimer);
      addLog('Realtime: disconnected — reconnect in 30s', 'sys');
      setTimeout(connect, 30000);
    };
  }

  connect();
}

function updateSBStatus() {
  const dot=document.getElementById('sbdot');
  const lbl=document.getElementById('sbstatus');
  if(!dot||!lbl) return;
  if(SB.ready) {
    const st = window._dbStorage;
    const col = st?.pct >= 90 ? '#ff4444' : st?.pct >= 70 ? '#ff8800' : '#4477ff';
    const icon = st?.pct >= 90 ? '!!!' : st?.pct >= 70 ? '⚠' : '✓';
    dot.style.background = col;
    dot.style.boxShadow = `0 0 5px ${col}`;
    lbl.textContent = `DB ${icon}`;
    lbl.style.color = col;
    lbl.title = st ? `~${st.estimatedMB}MB used of 500MB (${st.pct}%) — ${st.total.toLocaleString()} rows` : '';
  } else {
    dot.style.background='#2a3a4a';
    dot.style.boxShadow='none';
    lbl.textContent='DB —';
    lbl.style.color='var(--t4)';
  }
}

async function checkDBStorage() {
  if (!SB.ready || SHARE_MODE) return;
  try {
    const counts = await Promise.all(['positions','aircraft_positions','events'].map(async t => {
      const r = await fetch(`${SB.url}/rest/v1/${t}?select=count`, {
        headers: { ...SB._h({}), 'Prefer':'count=exact', 'Range-Unit':'items', 'Range':'0-0' },
      });
      return parseInt(r.headers.get('content-range')?.split('/')[1] || '0');
    }));
    const [posCount, acCount, evCount] = counts;
    const total = posCount + acCount + evCount;
    const estimatedMB = Math.round(total * 110 / 1e6); // ~110 bytes/row average
    const pct = Math.min(Math.round(estimatedMB / 500 * 100), 100);
    window._dbStorage = { posCount, acCount, evCount, total, estimatedMB, pct };
    updateSBStatus();
    if (pct >= 90) addLog(`DB STORAGE CRITICAL: ~${estimatedMB}MB / 500MB (${pct}%) — consider pruning old rows`, 'err');
    else if (pct >= 70) addLog(`DB STORAGE WARNING: ~${estimatedMB}MB / 500MB (${pct}%)`, 'news');
    else addLog(`DB storage: ~${estimatedMB}MB / 500MB (${pct}%) — ${total.toLocaleString()} rows`, 'db');
  } catch(e) { console.warn('[db] storage check failed:', e.message); }
}
