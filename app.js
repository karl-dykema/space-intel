'use strict';

// ── Public config (safe to commit — Supabase anon key is client-side by design) ──
const CFG_SB_URL  = 'https://wicxziyzayyymsubqpbi.supabase.co';
const CFG_SB_AKEY = 'sb_publishable_60y2euVA3BA6QpRVw_6mjw_F6J1ummh';

const SHARE_MODE = new URLSearchParams(location.search).has('share');

let history = {};
let events  = [];

// ── Activity log ──────────────────────────────────────────────
const logLines = [];
const MAX_LOG  = 500;
let   logUnread = 0;

const LOG_COLORS = {
  ais:   '#00d4ff',
  db:    '#4477ff',
  news:  '#ff8800',
  sys:   '#567fa0',
  event: '#00ff88',
  err:   '#ff4444',
};

function addLog(msg, type='sys') {
  const entry = { ts: Date.now(), msg, type };
  logLines.unshift(entry);
  if (logLines.length > MAX_LOG) logLines.pop();
  if (S.tab === 'log') {
    prependLogLine(entry);
  } else {
    logUnread++;
    const badge = document.getElementById('log-badge');
    if (badge) { badge.textContent = logUnread > 99 ? '99+' : logUnread; badge.style.display=''; }
  }
}

function prependLogLine(entry) {
  const panel = document.getElementById('rpanel');
  if (S.tab !== 'log' || !panel) return;
  const existing = panel.querySelector('.log-line');
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = `<span class="log-ts">${new Date(entry.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>` +
    `<span class="log-msg" style="color:${LOG_COLORS[entry.type]||'#888'}">${esc(entry.msg)}</span>`;
  if (existing) panel.insertBefore(div, panel.firstChild);
  else panel.innerHTML = '';
  panel.insertBefore(div, panel.firstChild);
  while (panel.querySelectorAll('.log-line').length > MAX_LOG) panel.removeChild(panel.lastChild);
}

function buildLogTab() {
  if (!logLines.length) return `<div class="empty">Activity log — AIS messages, DB reads/writes, and system events appear here.</div>`;
  return logLines.map(e =>
    `<div class="log-line"><span class="log-ts">${new Date(e.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>` +
    `<span class="log-msg" style="color:${LOG_COLORS[e.type]||'#888'}">${esc(e.msg)}</span></div>`
  ).join('');
}

function loadLS() {
  try { history = JSON.parse(localStorage.getItem(LS.HISTORY)||'{}'); } catch(e){history={};}
  try { events  = JSON.parse(localStorage.getItem(LS.EVENTS )||'[]'); } catch(e){events=[];}
  try {
    const cached = JSON.parse(localStorage.getItem(LS.MISSIONS)||'null');
    if(cached?.data && Date.now() - cached.ts < 3600000) missionsCache = cached.data;
  } catch(e) {}
  try {
    const cached = JSON.parse(localStorage.getItem(LS.MISSIONS_PAST)||'null');
    if(cached?.data && Date.now() - cached.ts < 3600000) pastMissionsCache = cached.data;
  } catch(e) {}
}

function saveMissions() {
  try { localStorage.setItem(LS.MISSIONS,      JSON.stringify({data:missionsCache,     ts:Date.now()})); } catch(e) {}
}
function savePastMissions() {
  try { localStorage.setItem(LS.MISSIONS_PAST, JSON.stringify({data:pastMissionsCache, ts:Date.now()})); } catch(e) {}
}
function saveLS() {
  try {
    localStorage.setItem(LS.HISTORY, JSON.stringify(history));
    localStorage.setItem(LS.EVENTS,  JSON.stringify(events.slice(0,MAX_EVENTS)));
  } catch(e) {
    Object.keys(history).forEach(m=>{
      if(history[m].positions.length>200) history[m].positions=history[m].positions.slice(-200);
    });
    try{localStorage.setItem(LS.HISTORY,JSON.stringify(history));}catch(e2){}
  }
}
setInterval(saveLS, 30000);

// ── Supabase REST client ──────────────────────────────────────
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

// Suppress GPS noise for stationary vessels: hold display position if new reading
// is within ~55m and SOG ≤ 0.5 kn. Big jumps (repositioning at dock) still accepted.
function smoothPos(prevLat, prevLon, rawLat, rawLon, sog) {
  if (!prevLat || sog > 0.5) return [rawLat, rawLon];
  const dlat = Math.abs(rawLat - prevLat), dlon = Math.abs(rawLon - prevLon);
  return (dlat < 0.0005 && dlon < 0.0005) ? [prevLat, prevLon] : [rawLat, rawLon];
}

// Throttle: one position write per vessel per 5 min
const sbLastPos = {};
function maybeSBPos(mmsi, lat, lon, sog, cog, ts) {
  if(!SB.ready) return;
  const moving = sog != null && sog > 0.5;
  const throttle = moving ? 15000 : 90000; // 15s underway, 90s stationary
  if(sbLastPos[mmsi] && ts-sbLastPos[mmsi] < throttle) return;
  sbLastPos[mmsi] = ts;
  SB.insert('positions', { mmsi, lat, lon, sog, cog, ts:new Date(ts).toISOString() });
}

// Throttle: one aircraft position write per 30s (admin only — share reads from Supabase)
const sbLastAcPos = {};
function maybeSBAcPos(reg, lat, lon, alt, gs, track, ts) {
  if(!SB.ready || SHARE_MODE) return;
  if(sbLastAcPos[reg] && ts - sbLastAcPos[reg] < 30000) return;
  sbLastAcPos[reg] = ts;
  SB.insert('aircraft_positions', { reg, lat, lon, alt: alt ?? null, gs: gs ?? null, track: track ?? null, ts: new Date(ts).toISOString() });
}

function sbWriteEvent(ev) {
  if(!SB.ready) return;
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

  // Bulk query: 30 days on first load (tracks), 2h on repeat polls (live sync only)
  const _sinceHistoric = new Date(Date.now()-30*86400000).toISOString();
  const _sinceLive     = new Date(Date.now()-2*3600000).toISOString();
  const _isFirstLoad   = !window._sbLoaded;
  window._sbLoaded     = true;
  const allRows = await SB.select('positions', {
    mmsi: `in.(${KNOWN_MMSIS.join(',')})`,
    ts: `gte.${_isFirstLoad ? _sinceHistoric : _sinceLive}`,
    order: 'ts.asc', limit: '10000',
    select: 'mmsi,lat,lon,ts,sog,cog',
  });
  if(allRows?.length) {
    const byMmsi = {};
    allRows.forEach(r => { (byMmsi[r.mmsi] = byMmsi[r.mmsi]||[]).push(r); });
    for(const [mmsi, rows] of Object.entries(byMmsi)) {
      if(!VESSEL_DB[mmsi]) continue;
      const pos = rows.map(r=>({lat:r.lat,lon:r.lon,ts:new Date(r.ts).getTime(),sog:r.sog,cog:r.cog}));
      if(!history[mmsi]) history[mmsi]={positions:[],firstSeen:pos[0].ts,lastSeen:pos[pos.length-1].ts};
      const existing = new Set(history[mmsi].positions.map(p=>Math.floor(p.ts/60000)));
      pos.forEach(p=>{ if(!existing.has(Math.floor(p.ts/60000))) history[mmsi].positions.push(p); });
      history[mmsi].positions.sort((a,b)=>a.ts-b.ts);
      history[mmsi].firstSeen = history[mmsi].positions[0].ts;
      history[mmsi].lastSeen  = history[mmsi].positions[history[mmsi].positions.length-1].ts;
      const last = history[mmsi].positions[history[mmsi].positions.length-1];
      // Share: Supabase is the only source — always apply latest. Admin: don't overwrite live AIS.
      if(SHARE_MODE || !S.vessels[mmsi] || last.ts > (S.vessels[mmsi].ts||0) || S.vessels[mmsi]._vapi) {
        S.vessels[mmsi] = {
          mmsi, ...VESSEL_DB[mmsi],
          lat:last.lat, lon:last.lon, sog:last.sog||0, cog:last.cog||0, ts:last.ts,
          track:history[mmsi].positions.map(p=>[p.lat,p.lon]),
          _historical:true,
        };
        updateMarker(S.vessels[mmsi]);
      }
    }
  }

  // Load aircraft track history (last 24h)
  const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
  const acRows = await SB.select('aircraft_positions', {
    ts: `gte.${since24h}`, order: 'ts.asc', limit: '3000',
    select: 'reg,lat,lon,alt,gs,track,ts',
  });
  if (acRows?.length) {
    const byReg = {};
    acRows.forEach(r => { (byReg[r.reg] = byReg[r.reg] || []).push(r); });
    for (const [reg, rows] of Object.entries(byReg)) {
      if (!AIRCRAFT_DB[reg]) continue;
      // Only use last contiguous flight segment — split at gaps >4h to avoid inter-flight connector lines
      const GAP_AC = 4 * 3600000;
      let segStart = 0;
      for (let i = 1; i < rows.length; i++) {
        if (new Date(rows[i].ts).getTime() - new Date(rows[i-1].ts).getTime() > GAP_AC) segStart = i;
      }
      const segRows = rows.slice(segStart);
      const pts = segRows.map(r => [r.lat, r.lon]);
      const last = rows[rows.length - 1];
      const lastTs = new Date(last.ts).getTime();
      const existing = S.aircraft[reg];
      const freshness = Date.now() - lastTs;
      const isStale = freshness > 5 * 60000;
      if (SHARE_MODE || !existing || lastTs > (existing.ts || 0)) {
        // Share: always use Supabase as source of truth (no live poll to merge with)
        // Admin first load or Supabase has newer data: replace position + track
        S.aircraft[reg] = {
          ...(existing || {}),
          reg, lat: last.lat, lon: last.lon,
          alt: last.alt, gs: last.gs, track: last.track ?? 0,
          ts: lastTs, _stale: isStale, _staleTs: isStale ? lastTs : undefined,
          _track: pts,
        };
      } else {
        // Admin: live track from pollAircraft is authoritative — don't corrupt it
        // with stale Supabase history. Nothing to do here.
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
      loadSBData(); // immediate refresh on (re)connect to catch anything during subscription gap
      // Separate phx_join per table — Supabase realtime v1 scopes each channel to one table
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
    dot.style.background='#4477ff';
    dot.style.boxShadow='0 0 5px #4477ff';
    lbl.textContent='DB ✓';
    lbl.style.color='#4477ff';
  } else {
    dot.style.background='#2a3a4a';
    dot.style.boxShadow='none';
    lbl.textContent='DB —';
    lbl.style.color='var(--t4)';
  }
}

// ── App state ─────────────────────────────────────────────────
const S = { ws:null, vessels:{}, aircraft:{}, selected:null, tab:'events' };
let missionsCache = [];
let pastMissionsCache = [];
let deployedFleet = new Set(); // MMSIs currently deployed at sea (out of AIS range)
const prevZones={};
let map=null, layers=null, zoneLayer=null, exclusionLayer=null, landmarkLayer=null, aircraftLayer=null;
let orbitLayer=null, rocketLayer=null, terminatorLayer=null, missionArcLayer=null;
let showLandmarks=true, showSpacecraft=true, showVessels=true, showAircraft=true;
const markers={}, tracks={}, aircraftMarkers={}, aircraftTracks={}, cogArrows={};
const spacecraftMarkers={}, orbitTracks={};
let selectedMissionForArc=null;
const _missionById={};
const S_spacecraft={};  // name → { abbr, operator, role, col, longterm, lat, lon, alt, satrec }
let tleData={};         // name → { satrec, meta }
let dockedManifest={};  // station name → [{name, abbr, operator, col}] from Space Devs API

// ── Port proximity ────────────────────────────────────────────
// Known port zones — any vessel last seen within ~8km is considered in port
const KNOWN_PORT_ZONES = [
  {lat:28.41,  lon:-80.61},  // Port Canaveral, FL
  {lat:33.75,  lon:-118.22}, // Port of Long Beach / LA, CA
  {lat:25.95,  lon:-97.40},  // Port of Brownsville, TX
  {lat:29.75,  lon:-95.27},  // Port of Houston, TX
  {lat:29.95,  lon:-90.07},  // Port of New Orleans, LA
  {lat:37.79,  lon:-122.39}, // Port of San Francisco, CA
  {lat:47.60,  lon:-122.34}, // Port of Seattle, WA
  {lat:30.40,  lon:-87.05},  // Port of Pensacola, FL
  {lat:25.77,  lon:-80.19},  // Port of Miami, FL
  {lat:-39.26, lon:177.86},  // Port of Gisborne / Māhia, NZ
];

function isNearPort(lat, lon, radiusKm=8) {
  if(lat==null||lon==null) return false;
  return KNOWN_PORT_ZONES.some(p=>{
    const dLat=lat-p.lat, dLon=(lon-p.lon)*Math.cos(p.lat*Math.PI/180);
    return Math.sqrt(dLat*dLat+dLon*dLon)*111 < radiusKm;
  });
}

// ── Mission linkage ───────────────────────────────────────────
// Home port coords for drone ships — used to detect "returned to port"
const DRONE_HOME_PORTS = {
  '368219910': {lat:28.41, lon:-80.61},  // ASOG — Port Canaveral
  '368351350': {lat:33.75, lon:-118.22}, // OCISLY — Port of Long Beach
  '368368960': {lat:28.41, lon:-80.61},  // Jacklyn — Port Canaveral
};

// Port webcams — shown in booster transit card when ship is approaching
const PORT_WEBCAMS = {
  '368219910': [ // ASOG — Port Canaveral
    {label:'Port Canaveral Webcam', url:'https://www.portcanaveralwebcam.com/'},
    {label:'Cruise Port & SpaceX Cam', url:'https://www.cruisingearth.com/port-webcams/united-states/port-canaveral-florida7/'},
  ],
  '368351350': [ // OCISLY — Port of Long Beach
    {label:'Long Beach Port Tracker', url:'https://www.cruisingearth.com/port-tracker/united-states/long-beach-california/', lookFor:'Look for MARMAC 304 (OCISLY\'s registered name)'},
  ],
  '368368960': [ // Jacklyn — Port Canaveral
    {label:'Port Canaveral Webcam', url:'https://www.portcanaveralwebcam.com/'},
    {label:'Cruise Port & SpaceX Cam', url:'https://www.cruisingearth.com/port-webcams/united-states/port-canaveral-florida7/'},
  ],
};

function isCarryingBooster(mmsi) {
  const role = (VESSEL_DB[mmsi]?.role||'').toLowerCase();
  if(!role.includes('drone') && !role.includes('landing platform')) return null;
  const now = Date.now();

  const mission = [...missionsCache, ...pastMissionsCache].find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if(!net) return false;
    const age = now - net;
    if(age < 600000 || age > 4*86400000) return false; // 10 min to 4 days
    const op = Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'';
    return vesselHintsForLaunch(op, l.pad?.name||'', l.pad?.location?.name||'').includes(mmsi);
  });
  if(!mission) return null;

  const v = S.vessels[mmsi];
  const home = DRONE_HOME_PORTS[mmsi];
  const age = now - new Date(mission.net).getTime();

  if(home && !v?.lat) return null; // no position yet, wait for data before showing flag
  if(v?.lat && home) {
    const dLat = v.lat - home.lat, dLon = (v.lon - home.lon) * Math.cos(home.lat * Math.PI/180);
    const distKm = Math.sqrt(dLat*dLat + dLon*dLon) * 111;
    // Within 3km → definitely at dock
    if(distKm < 3) return null;
    // Within 10km and slow/moored → docked or just departed
    if(distKm < 10 && (v.sog <= 0.5 || v.navStatus === 5 || v.navStatus === 1)) return null;
  }

  // In-session track: any position within 3km of home port since mission launch → booster was unloaded
  if(home && history[mmsi]?.positions) {
    const mNet = new Date(mission.net).getTime();
    const hadPortVisit = history[mmsi].positions.some(p => {
      if(p.ts <= mNet) return false;
      const dLat = p.lat - home.lat, dLon = (p.lon - home.lon) * Math.cos(home.lat * Math.PI/180);
      return Math.sqrt(dLat*dLat + dLon*dLon) * 111 < 3;
    });
    if(hadPortVisit) return null;
  }

  // After 36h+ if vessel is now stationary, it has returned and docked
  if(age > 36*3600000 && v?.sog != null && v.sog <= 0.1) return null;
  // After 36h with no AIS since launch, assume it returned to port off-coverage
  const mNet = new Date(mission.net).getTime();
  const freshSinceLaunch = v?.ts && v.ts > mNet && (now - v.ts < 24*3600000);
  if(age > 36*3600000 && !freshSinceLaunch) return null;

  return {...mission, _transit: age > 2*3600000};
}

function findActiveMission(mmsi) {
  if(!missionsCache.length) return null;
  const now = Date.now();
  return missionsCache.find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if(!net || Math.abs(now - net) > 12 * 3600000) return false;
    const op = Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'';
    return vesselHintsForLaunch(op, l.pad?.name||'', l.pad?.location?.name||'').includes(mmsi);
  }) || null;
}

// ── Events ────────────────────────────────────────────────────
function addEvent(mmsi, type, detail, lat, lon) {
  const info=VESSEL_DB[mmsi]||{};
  const cfg=EV_CFG[type]||{icon:'·',color:'#888'};
  const mission = findActiveMission(mmsi);
  if(mission) {
    const net=new Date(mission.net).getTime(), diff=Date.now()-net;
    const abs=Math.abs(diff), sign=diff>=0?'+':'-';
    const h=Math.floor(abs/3600000), m=Math.floor((abs%3600000)/60000);
    detail=`${detail} · ${mission.name} T${sign}${h}h${String(m).padStart(2,'0')}m`;
  }
  const ev={
    ts:Date.now(), mmsi,
    name:info.name||mmsi, abbr:info.abbr||mmsi,
    operator:info.operator||'Unknown', opColor:opColor(info.operator),
    type, icon:cfg.icon, typeColor:cfg.color,
    detail, lat:lat||null, lon:lon||null,
  };
  events.unshift(ev);
  if(events.length>MAX_EVENTS*2) events.pop();
  sbWriteEvent(ev);
  addLog(`EVT [${type}] ${info.abbr||mmsi} — ${detail}`, 'event');
  if(S.tab==='events') prependEventRow(ev);
  return ev;
}

// ── Facility cluster detection ────────────────────────────────
function detectFacilityClusters(radiusKm = 2) {
  const mooredEvs = events.filter(e => e.type === 'MOORED' && e.lat != null && e.lon != null);
  const clusters = [];
  for (const ev of mooredEvs) {
    let best = null, bestDist = radiusKm;
    for (const c of clusters) {
      const dLat = ev.lat - c.lat, dLon = ev.lon - c.lon;
      const d = Math.sqrt(dLat*dLat + dLon*dLon) * 111;
      if (d < bestDist) { best = c; bestDist = d; }
    }
    if (best) {
      const n = best.count;
      best.lat = (best.lat * n + ev.lat) / (n + 1);
      best.lon = (best.lon * n + ev.lon) / (n + 1);
      best.count++;
      best.vessels.add(ev.abbr || ev.name || String(ev.mmsi));
    } else {
      clusters.push({ lat: ev.lat, lon: ev.lon, count: 1, vessels: new Set([ev.abbr || ev.name || String(ev.mmsi)]) });
    }
  }
  return clusters.filter(c => c.count >= 2).sort((a, b) => b.count - a.count);
}

// ── AIS handler ───────────────────────────────────────────────
function handleAIS(msg) {
  const m=msg.MetaData||{};
  const pr=msg.Message?.PositionReport;
  const sd=msg.Message?.ShipStaticData;
  const mmsi=String(m.MMSI_String||m.MMSI||pr?.UserID||'');
  if(!mmsi||mmsi==='0'||!VESSEL_DB[mmsi]) return;

  const now=Date.now();
  const info=VESSEL_DB[mmsi];
  const prev=S.vessels[mmsi];
  const v=prev?{...prev}:{mmsi,...info,sog:0,cog:0,ts:0,track:[],_historical:false};

  if(pr) {
    const lat=pr.Latitude,lon=pr.Longitude;
    if(lat&&lon&&lat!==0&&lon!==0) {
      const wasStopped=!prev||prev.sog<=0.5;
      v.sog=pr.Sog??0; v.cog=pr.Cog??0;
      [v.lat, v.lon] = smoothPos(prev?.lat, prev?.lon, lat, lon, v.sog);
      v.navStatus=pr.NavigationalStatus; v.ts=now; v._historical=false;
      addLog(`AIS pos  ${info.abbr||mmsi}  ${lat.toFixed(4)}, ${lon.toFixed(4)}  ${v.sog.toFixed(1)} kn  COG ${Math.round(v.cog)}°`, 'ais');

      if(!history[mmsi]) {
        history[mmsi]={positions:[],firstSeen:now,lastSeen:now};
        addEvent(mmsi,'VESSEL_SEEN',`${info.abbr} spotted — ${lat.toFixed(3)}, ${lon.toFixed(3)}`,lat,lon);
      }
      history[mmsi].lastSeen=now;
      const lp=history[mmsi].positions.slice(-1)[0];
      if(!lp||now-lp.ts>60000||Math.abs(lat-lp.lat)>0.01||Math.abs(lon-lp.lon)>0.01) {
        history[mmsi].positions.push({lat,lon,ts:now,sog:v.sog,cog:v.cog});
        if(history[mmsi].positions.length>MAX_POS) history[mmsi].positions.shift();
        maybeSBPos(mmsi,lat,lon,v.sog,v.cog,now);
      }

      if(prev&&!prev._historical) {
        if(wasStopped &&v.sog>0.5)  addEvent(mmsi,'UNDERWAY',`${info.abbr} underway — ${v.sog.toFixed(1)} kn`,lat,lon);
        if(!wasStopped&&v.sog<=0.5) addEvent(mmsi,'MOORED',  `${info.abbr} stopped / moored`,lat,lon);
      }

      const nowZ=new Set(detectZones(lat,lon));
      const prvZ=prevZones[mmsi];  // undefined on first ping — don't fire events
      const role=(info.role||'').toLowerCase();
      const zoneMatters=z=>!z.silent&&(!z.roles||z.roles.some(r=>role.includes(r)));
      if(prvZ) {
        nowZ.forEach(zid=>{if(!prvZ.has(zid)){const z=ZONES.find(z=>z.id===zid);if(zoneMatters(z))addEvent(mmsi,'ZONE_ENTER',`${info.abbr} entered ${z.name}`,lat,lon);}});
        prvZ.forEach(zid=>{if(!nowZ.has(zid)){const z=ZONES.find(z=>z.id===zid);if(zoneMatters(z))addEvent(mmsi,'ZONE_EXIT', `${info.abbr} left ${z.name}`,lat,lon);}});
      }
      prevZones[mmsi]=nowZ;

      const lt=v.track.slice(-1)[0];
      if(!lt||Math.abs(lat-lt[0])>0.0002||Math.abs(lon-lt[1])>0.0002) {
        v.track.push([lat,lon]);
        if(v.track.length>1000) v.track.shift();
      }
      showPingRing(v.lat, v.lon, opColor(info.operator));
    }
  }

  if(sd) {
    const n=(sd.Name||m.ShipName||'').trim().replace(/@+$/,'');
    if(n){ v.aisName=n; addLog(`AIS static ${info.abbr||mmsi}  name="${n}"${sd.Destination?' dest='+sd.Destination.trim().replace(/@+$/,''):''}`, 'ais'); }
    if(sd.Destination) {
      const dest=(sd.Destination||'').trim().replace(/@+$/,'');
      if(dest&&dest!==v.dest) {
        if(v.dest) addEvent(mmsi,'DEST_CHANGE',`${info.abbr} destination → ${dest}`,v.lat,v.lon);
        v.dest=dest;
      }
    }
    if(sd.EtaMonth)  v.eta=`${sd.EtaMonth}/${String(sd.EtaDay).padStart(2,'0')} ${String(sd.EtaHour).padStart(2,'0')}:${String(sd.EtaMinute).padStart(2,'0')}Z`;
    if(sd.ImoNumber) v.imo=sd.ImoNumber;
    if(sd.CallSign)  v.cs=(sd.CallSign||'').trim().replace(/@+$/,'');
    if(sd.Draught||sd.MaximumStaticDraught) v.draught=sd.MaximumStaticDraught||sd.Draught;
  }

  S.vessels[mmsi]=v;
  updateMarker(v);
  updateHeaderStats();
  renderFleet();
  if(S.selected===mmsi&&S.tab==='vessel') renderRight();
}

// AIS gap check
setInterval(()=>{
  const now=Date.now();
  Object.entries(S.vessels).forEach(([mmsi,v])=>{
    if(!v._historical&&v.ts&&now-v.ts>7200000) {
      const hrs=Math.round((now-v.ts)/3600000);
      addEvent(mmsi,'AIS_GAP',`${v.abbr||mmsi} dark for ${hrs}h — last: ${v.lat?.toFixed(3)}, ${v.lon?.toFixed(3)}`,v.lat,v.lon);
      delete S.vessels[mmsi];
    }
  });
},900000);

// ── Map ───────────────────────────────────────────────────────
function initMap() {
  map=L.map('map',{zoomControl:true,attributionControl:true,minZoom:2,maxZoom:19,maxBounds:[[-90,-180],[90,180]],maxBoundsViscosity:1.0,worldCopyJump:false});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    attribution:'© CARTO © OSM',subdomains:'abcd',maxZoom:19,noWrap:true,bounds:[[-90,-180],[90,180]],
  }).addTo(map);
  terminatorLayer=L.layerGroup().addTo(map);
  exclusionLayer=L.layerGroup().addTo(map);
  landmarkLayer=L.layerGroup().addTo(map);
  missionArcLayer=L.layerGroup().addTo(map);
  orbitLayer=L.layerGroup().addTo(map);
  rocketLayer=L.layerGroup().addTo(map);
  aircraftLayer=L.layerGroup().addTo(map);
  layers=L.layerGroup().addTo(map);
  zoneLayer=L.layerGroup().addTo(map);
  map.setView([20,0],2);
  drawExclusionZones();
  drawZones();
  drawLandmarks();
  document.getElementById('mapleg-ops').innerHTML=
    Object.entries(OP_COLORS).map(([op,c])=>
      `<div style="display:flex;gap:6px;align-items:center;font-size:10px;color:${c};margin-bottom:3px">
        <div style="width:12px;height:3px;background:${c};border-radius:1px"></div>${op}</div>`
    ).join('') +
    `<div style="display:flex;gap:6px;align-items:center;font-size:10px;color:#ff8c00;margin-top:5px;padding-top:5px;border-top:1px solid var(--bdr2)">
      <div style="width:12px;height:3px;background:#ff8c00;border-radius:1px;opacity:0.7"></div>Safety Zone</div>
    <div style="margin-top:8px;padding-top:5px;border-top:1px solid var(--bdr2);font-size:9px;color:var(--t4);letter-spacing:.06em;margin-bottom:3px">LANDMARKS</div>` +
    [
      ['#ff4400','Launch pad',   `<svg width="10" height="10" viewBox="0 0 11 11"><polygon points="5.5,1 10,10 5.5,7.5 1,10" fill="#ff4400"/></svg>`],
      ['#ffcc00','Viewing area', `<svg width="9" height="9" viewBox="0 0 9 9"><rect x="0.5" y="0.5" width="8" height="8" rx="1" fill="#ffcc00"/></svg>`],
      ['#00aaff','Facility',     `<svg width="9" height="9" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#00aaff"/></svg>`],
      ['#00cc88','Port',         `<svg width="9" height="9" viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5" fill="#00cc88"/></svg>`],
    ].map(([c,l,icon])=>
      `<div style="display:flex;gap:6px;align-items:center;font-size:10px;color:${c};margin-bottom:2px">${icon}${l}</div>`
    ).join('');
}

function drawExclusionZones() {
  const style = { color:'#ff8c00', fillColor:'#ff8c00', fillOpacity:0.04, weight:1.2, dashArray:'6 3' };
  const tipUSCG = (name, cfr) => `<b style="color:#ff8c00">${name}</b><br><span style="font-size:11px;color:var(--t5)">USCG Safety Zone · ${cfr}</span>`;
  const tipIntl = (name, auth) => `<b style="color:#ff8c00">${name}</b><br><span style="font-size:11px;color:var(--t5)">Maritime Exclusion Zone · ${auth}</span>`;

  // Cape Canaveral — 33 CFR 165.775 (12 nm offshore boundary)
  L.polygon([
    [28.815, -80.478], [28.722, -80.683], [28.422, -80.579],
    [28.183, -80.483], [28.167, -80.354], [28.815, -80.354],
  ], style).addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Cape Canaveral Maritime Safety Zone','33 CFR 165.775'),{className:'ltt',direction:'auto'});

  // Vandenberg — 33 CFR 334.1130 (3 nm offshore danger zones)
  L.polygon([
    [34.902, -120.671], [34.902, -120.733], [34.880, -120.733],
    [34.833, -120.675], [34.747, -120.704], [34.697, -120.670],
    [34.587, -120.713], [34.550, -120.685], [34.511, -120.625],
    [34.405, -120.500], [34.393, -120.452], [34.406, -120.411],
    [34.456, -120.411],
  ], style).addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Vandenberg Maritime Danger Zone','33 CFR 334.1130'),{className:'ltt',direction:'auto'});

  // Starbase / Boca Chica — USCG enforces ad-hoc safety zones per launch
  L.circle([26.0, -97.15], {radius:28000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Starbase / Boca Chica Safety Zone','Ad-hoc USCG marine safety notices'),{className:'ltt',direction:'auto'});

  // Wallops Island (NASA/Northrop Grumman) — FAA/USCG launch safety zones
  L.circle([37.94, -75.47], {radius:30000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Wallops Island Maritime Safety Zone','USCG/FAA launch safety zones'),{className:'ltt',direction:'auto'});

  // Māhia Peninsula, NZ — Rocket Lab maritime exclusion
  L.circle([-39.26, 177.87], {radius:20000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Māhia Launch Exclusion Zone','Maritime NZ exclusion notices'),{className:'ltt',direction:'auto'});

  // Kourou / Centre Spatial Guyanais — ESA/Arianespace Atlantic exclusion
  L.circle([5.24, -52.77], {radius:60000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Kourou (CSG) Maritime Exclusion Zone','French DGAC / CNES notices'),{className:'ltt',direction:'auto'});

  // Alcântara, Brazil — AEB/Itamar
  L.circle([-2.37, -44.40], {radius:30000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Alcântara Launch Center Maritime Zone','DECEA/AEB airspace & maritime notices'),{className:'ltt',direction:'auto'});

  // Wenchang Space Launch Center — CNSA South China Sea exclusion
  L.circle([19.61, 110.95], {radius:45000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Wenchang Maritime Exclusion Zone','CNSA / China MSA notices'),{className:'ltt',direction:'auto'});

  // Tanegashima Space Center — JAXA Pacific exclusion
  L.circle([30.38, 130.97], {radius:35000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Tanegashima Maritime Exclusion Zone','JAXA / Japan JCG notices'),{className:'ltt',direction:'auto'});

  // Satish Dhawan Space Centre (SHAR) — ISRO Bay of Bengal exclusion
  L.circle([13.73, 80.23], {radius:35000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('SHAR (Sriharikota) Maritime Exclusion Zone','ISRO / India Coast Guard notices'),{className:'ltt',direction:'auto'});

  // Naro Space Center, South Korea — KARI exclusion
  L.circle([34.43, 127.54], {radius:20000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Naro Space Center Maritime Zone','KARI / Korea Coast Guard notices'),{className:'ltt',direction:'auto'});

  // Starship Indian Ocean Landing Zone — consistent splashdown target IFT-11 / IFT-12
  L.circle([-19.0, 107.0], {radius:150000, color:'#00d4ff', fillColor:'#00d4ff', fillOpacity:0.03, weight:1.0, dashArray:'4 6'})
    .addTo(exclusionLayer)
    .bindTooltip('<b style="color:#00d4ff">Starship Indian Ocean Landing Zone</b><br><span style="font-size:11px;color:var(--t5)">~19°S 107°E · IFT-11 &amp; IFT-12 splashdown target<br>Future recovery ship staging area</span>',{className:'ltt',direction:'auto'});

  // Starfall Pacific reentry zone — FAA EA May 2026, ~700nm off US West Coast
  L.circle([29.0, -131.0], {radius:350000, color:'#00d4ff', fillColor:'#00d4ff', fillOpacity:0.03, weight:1.0, dashArray:'4 6'})
    .addTo(exclusionLayer)
    .bindTooltip('<b style="color:#00d4ff">Starfall Reentry Zone</b><br><span style="font-size:11px;color:var(--t5)">~700nm off US West Coast · outside 200nm EEZ<br>SpaceX uncrewed reentry capsule (3.1m, 2,100kg)<br>In-orbit manufacturing &amp; rapid cargo delivery · FAA EA May 2026</span>',{className:'ltt',direction:'auto'});
}

function drawZones() {
  [{id:'canaveral',lat:28.5,lon:-80.65,r:40},{id:'boca_chica',lat:26.0,lon:-97.15,r:25},
   {id:'vandenberg',lat:34.65,lon:-120.6,r:25},{id:'lc1_nz',lat:-39.25,lon:177.9,r:18},
   {id:'atl_recovery',lat:28.5,lon:-76.0,r:110},{id:'pac_recovery',lat:29.8,lon:-120.6,r:160},
   {id:'gulf_ops',lat:27.0,lon:-92.0,r:90}].forEach(z=>{
    const def=ZONES.find(zz=>zz.id===z.id);
    L.circle([z.lat,z.lon],{radius:z.r*1000,color:'#0c3352',fillColor:'#041525',fillOpacity:0.2,weight:1,dashArray:'4 4'})
      .addTo(zoneLayer).bindTooltip(def?.name||z.id,{className:'ltt',direction:'auto'});
  });
}

function drawLandmarks() {
  if(!landmarkLayer || typeof LANDMARKS === 'undefined') return;
  landmarkLayer.clearLayers();
  if(!showLandmarks) return;
  const TYPE_STYLE = {
    launch:   { col:'#ff4400' },
    viewing:  { col:'#ffcc00' },
    facility: { col:'#00aaff' },
    port:     { col:'#00cc88' },
    dsn:      { col:'#cc66ff' },
  };
  const landmarkSvg = (type, col) => {
    if (type === 'launch')
      return `<svg width="11" height="11" viewBox="0 0 11 11"><polygon points="5.5,1 10,10 5.5,7.5 1,10" fill="${col}" stroke="none" opacity="0.9"/></svg>`;
    if (type === 'facility')
      return `<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="${col}" stroke="none" opacity="0.85"/></svg>`;
    if (type === 'viewing')
      return `<svg width="9" height="9" viewBox="0 0 9 9"><rect x="0.5" y="0.5" width="8" height="8" rx="1" fill="${col}" stroke="none" opacity="0.85"/></svg>`;
    if (type === 'port')
      return `<svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5" fill="${col}" stroke="none" opacity="0.85"/></svg>`;
    if (type === 'dsn')
      return `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5.5" fill="${col}" opacity="0.85"/><circle cx="6" cy="6" r="2.5" fill="#0c1929" opacity="1"/></svg>`;
    return `<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="${col}" opacity="0.7"/></svg>`;
  };
  LANDMARKS.forEach(lm => {
    const st = TYPE_STYLE[lm.type] || { col:'#888' };
    const svg = landmarkSvg(lm.type, st.col);
    const sz = lm.type === 'launch' ? 11 : lm.type === 'dsn' ? 12 : 10;
    const icon = L.divIcon({ html: svg, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], className:'' });
    const linkHtml = lm.link
      ? `<br><a href="${lm.link}" target="_blank" style="font-size:10px;color:var(--acc);text-decoration:none">↗ ${esc(lm.link.replace(/^https?:\/\/(www\.)?/,'').split('/')[0])}</a>`
      : '';
    L.marker([lm.lat, lm.lon], { icon, zIndexOffset:-500 })
      .addTo(landmarkLayer)
      .bindTooltip(
        `<b style="color:${st.col}">${esc(lm.name)}</b><br>
        <span style="font-size:10px;color:var(--t4);text-transform:uppercase;letter-spacing:.05em">${lm.type}</span><br>
        <span style="font-size:11px;color:var(--t3)">${esc(lm.desc)}</span>${linkHtml}`,
        { className:'ltt ltt-wrap', direction:'auto', maxWidth:200 }
      );
  });
}

function toggleLandmarks() {
  showLandmarks = !showLandmarks;
  drawLandmarks();
  const btn = document.getElementById('landmark-btn');
  if(btn) btn.style.opacity = showLandmarks ? '1' : '0.4';
}

function toggleLegend() {
  const ops  = document.getElementById('mapleg-ops');
  const chev = document.getElementById('legend-chevron');
  if (!ops) return;
  const collapsed = ops.style.display === 'none';
  ops.style.display  = collapsed ? '' : 'none';
  if (chev) chev.textContent = collapsed ? '▾' : '▸';
  try { localStorage.setItem('legend_collapsed', collapsed ? '0' : '1'); } catch(e) {}
}

function showPingRing(lat, lon, col) {
  if (!map || !layers) return;
  const icon = L.divIcon({
    html: `<div class="ping-ring" style="width:22px;height:22px;border-color:${col}"></div>`,
    iconSize:[22,22], iconAnchor:[11,11], className:''
  });
  const m = L.marker([lat, lon], {icon, zIndexOffset:-300, interactive:false}).addTo(layers);
  setTimeout(() => { try { layers.removeLayer(m); } catch(e) {} }, 5000);
}

function updateMarker(v) {
  if(!map||!layers||!v.lat||!v.lon) return;
  const mmsi=v.mmsi, col=opColor(v.operator), sel=S.selected===mmsi;
  const hist=!!v._historical&&(Date.now()-v.ts>600000); // dim only if historical AND older than 10min
  const vapi=v._vapi&&!SHARE_MODE;
  const stale=!hist&&!vapi&&!!v.ts&&(Date.now()-v.ts>7200000); // >2h old and not already flagged
  const hollow=hist||vapi||stale;
  const docked=!hist&&!vapi&&!stale&&!!v.ts&&(Date.now()-v.ts<600000)&&(v.sog==null||v.sog<=0.1);
  const sz=sel?22:14, cog=v.cog||0;
  const opacity=hist?(sel?0.7:0.45):vapi?(sel?0.8:0.6):stale?(sel?0.65:0.4):docked?(sel?0.65:0.45):(sel?1:0.85);
  const svg=`<svg width="${sz}" height="${sz}" viewBox="0 0 20 20">
    <polygon points="10,1 14.5,17 10,13.5 5.5,17" fill="${hollow?'none':col}" stroke="${col}"
      stroke-width="1.5" transform="rotate(${cog},10,10)" opacity="${opacity}"/>
    ${sel?`<circle cx="10" cy="10" r="9" fill="none" stroke="${col}" stroke-width="1.2" opacity="0.35"/>`:''}</svg>`;
  const icon=L.divIcon({html:svg,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2],className:''});
  if(!markers[mmsi]) {
    markers[mmsi]=L.marker([v.lat,v.lon],{icon,zIndexOffset:sel?1000:0})
      .addTo(layers).on('click',()=>selectVessel(mmsi));
  } else {
    markers[mmsi].setLatLng([v.lat,v.lon]);
    markers[mmsi].setIcon(icon);
    markers[mmsi].setZIndexOffset(sel?1000:0);
  }
  const age=hist?` · last seen ${ageStr(v.ts)}`:vapi?` · VesselAPI ${ageStr(v.ts)}`:stale?` · last seen ${ageStr(v.ts)}`:'';
  markers[mmsi].bindTooltip(
    `<b style="color:${col}">${esc(v.abbr||v.name)}</b><br>
    <span style="color:var(--t5)">${esc(v.operator)}</span><br>${esc(v.role)}<br>
    ${v.sog!=null&&!hollow?v.sog.toFixed(1)+' kn':''}${age}${v.dest&&!hollow?' → '+esc(v.dest):''}`,
    {className:'ltt',direction:'auto'}
  );
  if(v.track&&v.track.length>1) {
    const trackStyle={color:col,weight:hollow?1:2,opacity:hist?0.25:vapi?0.3:stale?0.2:0.5,dashArray:hollow?'3 5':null};
    if(tracks[mmsi]) { tracks[mmsi].setLatLngs(v.track); tracks[mmsi].setStyle(trackStyle); }
    else tracks[mmsi]=L.polyline(v.track,trackStyle).addTo(layers).on('click',()=>selectVessel(mmsi));
  }
  // COG heading arrow — project forward 10 min at current SOG
  if(!hollow && v.sog>0.5 && v.cog!=null && v.lat && v.lon) {
    const distKm = v.sog * 1.852 * 10/60;
    const cogRad = v.cog * Math.PI/180;
    const dLat = distKm * Math.cos(cogRad) / 111;
    const dLon = distKm * Math.sin(cogRad) / (111 * Math.cos(v.lat * Math.PI/180));
    const endPt = [v.lat+dLat, v.lon+dLon];
    const arStyle = {color:col, weight:1.5, opacity:0.55, dashArray:'5 4'};
    if(cogArrows[mmsi]) { cogArrows[mmsi].setLatLngs([[v.lat,v.lon],endPt]); cogArrows[mmsi].setStyle(arStyle); }
    else cogArrows[mmsi] = L.polyline([[v.lat,v.lon],endPt], arStyle).addTo(layers);
  } else if(cogArrows[mmsi]) {
    try { layers.removeLayer(cogArrows[mmsi]); } catch(e) {}
    delete cogArrows[mmsi];
  }
}

function selectVessel(mmsi) {
  S.selected=mmsi;
  const v=S.vessels[mmsi];
  if(v?.lat&&v?.lon&&map) map.setView([v.lat,v.lon],7);
  Object.values(S.vessels).forEach(vv=>{if(vv.lat)updateMarker(vv);});
  renderFleet();
  setTab('vessel');
}

// ── Aircraft tracking ─────────────────────────────────────────
const AIRCRAFT_API = 'https://api.airplanes.live/v2/reg/';
const AIRCRAFT_POLL_MS = 60000;

async function pollAircraft() {
  if(!map) return;
  const regs = Object.keys(AIRCRAFT_DB);
  for(const reg of regs) {
    try {
      const res = await fetch(AIRCRAFT_API + encodeURIComponent(reg));
      if(!res.ok) continue;
      const data = await res.json();
      const ac = data.ac?.[0];
      if(!ac?.lat || !ac?.lon) {
        if(S.aircraft[reg] && !S.aircraft[reg]._stale) {
          S.aircraft[reg]._stale = true;
          S.aircraft[reg]._staleTs = Date.now(); // record when we lost the signal
          updateAircraftMarker(reg); // re-render as faded
        }
        continue;
      }
      const prevAc = S.aircraft[reg];
      // Start fresh track if last known position is >4h old (different flight)
      const _track = (prevAc?.ts && Date.now() - prevAc.ts > 4*3600000) ? [] : (prevAc?._track || []);
      const lastPt = _track[_track.length - 1];
      const moved = !lastPt || Math.abs(lastPt[0] - ac.lat) > 0.001 || Math.abs(lastPt[1] - ac.lon) > 0.001;
      if (moved) {
        _track.push([ac.lat, ac.lon]);
        if (_track.length > 500) _track.shift();
      }
      const acTs = data.now || Date.now();
      S.aircraft[reg] = {
        reg,
        lat: ac.lat, lon: ac.lon,
        alt: ac.alt_baro,
        gs: ac.gs,
        track: ac.track ?? 0,
        hex: ac.hex,
        ts: acTs,
        _stale: false,
        _track,
      };
      if (moved) maybeSBAcPos(reg, ac.lat, ac.lon, ac.alt_baro, ac.gs, ac.track ?? 0, acTs);
      updateAircraftMarker(reg);
    } catch(_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  renderFleet();
}

function updateAircraftMarker(reg) {
  if(!map || !aircraftLayer) return;
  const ac = S.aircraft[reg];
  const db = AIRCRAFT_DB[reg];
  if(!ac?.lat || !ac?.lon || !db) return;
  const col = opColor(db.operator);
  const sz = 16;
  const t = ac.track || 0;
  const isHelo = db.type === 'helicopter';
  const opacity = ac._stale ? 0.35 : 1;
  const fill = ac._stale ? 'none' : col;
  const shape = isHelo
    ? `<circle cx="10" cy="10" r="5" fill="none" stroke="${col}" stroke-width="1.8" opacity="${opacity}"/>
       <line x1="10" y1="4" x2="10" y2="16" stroke="${col}" stroke-width="1.5" opacity="${opacity}"/>
       <line x1="4" y1="10" x2="16" y2="10" stroke="${col}" stroke-width="1.5" opacity="${opacity}"/>`
    : `<polygon points="10,2 13,16 10,12 7,16" fill="${fill}" stroke="${col}" stroke-width="0.5" opacity="${opacity}"/>`;
  const svg = `<svg width="${sz}" height="${sz}" viewBox="0 0 20 20" style="transform:rotate(${t}deg);transform-origin:50% 50%;display:block">
    ${shape}
  </svg>`;
  const icon = L.divIcon({html:svg, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], className:''});
  const staleNote = ac._stale && ac._staleTs ? `<br><span style="color:#ffcc00;font-size:10px">last seen ${ageStr(ac._staleTs)}</span>` : '';
  const alt = !ac._stale && ac.alt != null ? `<br><span style="color:var(--t3);font-size:10px">${Math.round(ac.alt).toLocaleString()} ft</span>` : '';
  const spd = !ac._stale && ac.gs != null ? ` · <b style="color:#00ff88">${Math.round(ac.gs)} kn</b>` : '';
  const tooltip = `<b style="color:${col}">${esc(db.abbr)}</b>${spd}<br>
    <span style="color:var(--t5)">${esc(db.operator)}</span><br>${esc(db.role)}${alt}${staleNote}`;
  if(!aircraftMarkers[reg]) {
    aircraftMarkers[reg] = L.marker([ac.lat, ac.lon], {icon, zIndexOffset:500})
      .addTo(aircraftLayer)
      .on('click', () => showAircraftDetail(reg));
  } else {
    aircraftMarkers[reg].setLatLng([ac.lat, ac.lon]);
    aircraftMarkers[reg].setIcon(icon);
  }
  aircraftMarkers[reg].bindTooltip(tooltip, {className:'ltt', direction:'auto'});

  // Draw flight path track
  if (ac._track && ac._track.length > 1) {
    const trackStyle = { color: col, weight: 1.5, opacity: ac._stale ? 0.2 : 0.45, dashArray: ac._stale ? '3 6' : null };
    if (aircraftTracks[reg]) {
      aircraftTracks[reg].setLatLngs(ac._track);
      aircraftTracks[reg].setStyle(trackStyle);
    } else {
      aircraftTracks[reg] = L.polyline(ac._track, trackStyle).addTo(aircraftLayer).on('click', () => showAircraftDetail(reg));
    }
  }
}

// ── Orbit tracker ─────────────────────────────────────────────
// data/stations.tle is refreshed by GitHub Actions every 2h (same origin = no CORS).
// Ivan API is a CORS-open fallback if the file is missing or stale.
const IVAN_BASE = 'https://tle.ivanstanojevic.me/api/tle';

// Space Devs station IDs for ISS and CSS (Tiangong space station)
const SPACEDEVS_STATIONS = { 'ISS (ZARYA)': 4, 'CSS (TIANHE)': 18 };

// Static module info for space stations — permanent modules + visiting vehicle context.
// visitingNotes: array of {match (regex), location?, note} — first match wins per spacecraft.
const STATION_INFO = {
  'CSS (TIANHE)': {
    fullName: 'China Space Station (Tiangong)',
    agency: 'CNSA',
    modules: [
      { name: 'Wentian',  role: 'Laboratory Module', location: 'Starboard berthing port', col: '#ff6644' },
      { name: 'Mengtian', role: 'Laboratory Module', location: 'Port-side berthing port',  col: '#ff6644' },
    ],
    visitingNotes: [
      { match: /shenzhou/i, location: 'Forward port', note: 'Crewed · 3-astronaut crew including first astronaut from Hong Kong · one crew member on a 1-year stay' },
      { match: /tianzhou/i, location: 'Aft port',     note: 'Cargo · propellant, life support consumables, and scientific payloads' },
    ]
  },
  'ISS (ZARYA)': {
    fullName: 'International Space Station',
    agency: 'NASA · Roscosmos · ESA · JAXA · CSA',
    modules: [],
    visitingNotes: [
      { match: /crew dragon/i,    note: 'Expedition 74 crew transport · SpaceX Crew-12' },
      { match: /cargo dragon/i,   note: 'Cargo resupply · SpaceX CRS-34, arrived May 2026' },
      { match: /cygnus/i,         note: 'Northrop Grumman commercial cargo resupply' },
      { match: /progress ms-34/i, note: 'Roscosmos uncrewed cargo and resupply · docked April 2026' },
      { match: /progress ms-33/i, note: 'Roscosmos uncrewed cargo and resupply · docked March 2026' },
      { match: /progress/i,       note: 'Roscosmos uncrewed cargo and resupply' },
      { match: /soyuz/i,          note: 'Roscosmos crew transport · Soyuz MS-28' },
    ]
  }
};

async function fetchDockedManifest() {
  const CACHE_KEY = 'dockedManifestV1';
  const CACHE_TTL = 4 * 3600000; // 4 hours — well under Space Devs rate limit

  // Use cached manifest if still fresh
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      dockedManifest = cached.data;
      addLog(`Orbit: docking manifest (cache, ISS:${cached.data['ISS (ZARYA)']?.length||0} CSS:${cached.data['CSS (TIANHE)']?.length||0})`, 'sys');
      renderFleet();
      return;
    }
  } catch(e) {}

  const since = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
  const STATION_ID_MAP = { 4: 'ISS (ZARYA)', 18: 'CSS (TIANHE)' };
  // Classify craft type by name; station assigned by docking_location.spacestation.id (authoritative)
  const classify = name => {
    const n = name.toLowerCase();
    if (/crew dragon/.test(n))              return { abbr:'Dragon',   operator:'SpaceX',           col:'#00d4ff' };
    if (/cargo dragon|dragon crs/.test(n))  return { abbr:'Dragon',   operator:'SpaceX',           col:'#00d4ff' };
    if (/cygnus/.test(n))                   return { abbr:'Cygnus',   operator:'Northrop Grumman', col:'#dd8800' };
    if (/progress/.test(n))                 return { abbr:'Progress', operator:'Roscosmos',         col:'#9966ff' };
    if (/soyuz/.test(n))                    return { abbr:'Soyuz',    operator:'Roscosmos',         col:'#9966ff' };
    if (/tianzhou/.test(n))                 return { abbr:'Tianzhou', operator:'CNSA',              col:'#ff6644' };
    if (/shenzhou/.test(n))                 return { abbr:'Shenzhou', operator:'CNSA',              col:'#ff6644' };
    if (/orion/.test(n))                    return { abbr:'Orion',    operator:'NASA',              col:'#ff6600' };
    return null;
  };

  const manifest = { 'ISS (ZARYA)': [], 'CSS (TIANHE)': [] };
  const seen = new Set();
  // Use lldev (no rate limits); one query is enough — it returns events for all stations
  try {
    const url = `https://lldev.thespacedevs.com/2.2.0/docking_event/?docking__gte=${since}&departure__isnull=true&limit=50&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      for (const ev of (data.results || [])) {
        const scName = ev.flight_vehicle?.spacecraft?.name || '';
        const stId   = ev.docking_location?.spacestation?.id;
        const station = STATION_ID_MAP[stId];
        if (!scName || !station || seen.has(scName)) continue;
        seen.add(scName);
        const meta = classify(scName);
        if (!meta) continue;
        manifest[station].push({ name: scName, ...meta });
      }
    }
  } catch(e) {}

  if (Object.values(manifest).some(d => d.length > 0)) {
    dockedManifest = manifest;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: manifest })); } catch(e) {}
    addLog(`Orbit: docking manifest loaded (ISS:${manifest['ISS (ZARYA)'].length} CSS:${manifest['CSS (TIANHE)'].length})`, 'sys');
    renderFleet();
  }
}

function parseTLEText(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  let found = 0;
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i], l1 = lines[i+1], l2 = lines[i+2];
    if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) { i -= 2; continue; }
    const pat = SPACECRAFT_PATTERNS.find(p => p.match(name));
    if (!pat) continue;
    try { tleData[name] = { satrec: satellite.twoline2satrec(l1, l2), meta: pat, name }; found++; } catch(e) {}
  }
  return found;
}

async function fetchTLEsFromIvanAPI() {
  // Full fallback: fetch everything when local file is unavailable
  const queries = [
    `${IVAN_BASE}/25544`, `${IVAN_BASE}/48274`,
    `${IVAN_BASE}?search=SOYUZ-MS&page-size=5`,
    `${IVAN_BASE}?search=PROGRESS-MS&page-size=5`,
    `${IVAN_BASE}?search=SHENZHOU&page-size=5`,
    `${IVAN_BASE}?search=TIANZHOU&page-size=5`,
    `${IVAN_BASE}?search=CREW+DRAGON&page-size=1`,
    `${IVAN_BASE}?search=DRAGON+CRS&page-size=1`,
    `${IVAN_BASE}?search=CYGNUS+NG&page-size=1`,
  ];
  const results = await Promise.allSettled(queries.map(u => fetch(u).then(r => r.ok ? r.json() : null)));
  let found = 0;
  for (const res of results) {
    if (res.status !== 'fulfilled' || !res.value) continue;
    const items = Array.isArray(res.value.member) ? res.value.member : [res.value];
    for (const item of items) {
      if (!item?.name || !item?.line1 || !item?.line2) continue;
      if (/DEB|OBJECT|R\/B/i.test(item.name)) continue;
      const pat = SPACECRAFT_PATTERNS.find(p => p.match(item.name));
      if (!pat || tleData[item.name]) continue;
      try { tleData[item.name] = { satrec: satellite.twoline2satrec(item.line1, item.line2), meta: pat, name: item.name }; found++; } catch(e) {}
    }
  }
  return found;
}

function tleEpochAgeDays(line1) {
  const ep = line1.substring(18, 32).trim();
  const yy = parseInt(ep.substring(0, 2));
  const day = parseFloat(ep.substring(2));
  const yr = yy < 57 ? 2000 + yy : 1900 + yy;
  return (Date.now() - (Date.UTC(yr, 0, 1) + (day - 1) * 86400000)) / 86400000;
}

async function fetchActiveMissionTLEs() {
  // Supplement local file with all currently active docked/mission craft.
  // Epoch age check (14 days) filters out returned/ended missions — active docked
  // craft receive daily TLE updates; anything older means the mission ended.
  const queries = [
    `${IVAN_BASE}?search=SOYUZ-MS&page-size=3`,
    `${IVAN_BASE}?search=PROGRESS-MS&page-size=3`,
    `${IVAN_BASE}?search=SHENZHOU&page-size=2`,
    `${IVAN_BASE}?search=TIANZHOU&page-size=2`,
    `${IVAN_BASE}?search=WENTIAN&page-size=1`,
    `${IVAN_BASE}?search=MENGTIAN&page-size=1`,
    `${IVAN_BASE}?search=CREW+DRAGON&page-size=1`,
    `${IVAN_BASE}?search=DRAGON+CRS&page-size=1`,
    `${IVAN_BASE}?search=CYGNUS+NG&page-size=1`,
    `${IVAN_BASE}?search=ORION&page-size=1`,
  ];
  const results = await Promise.allSettled(queries.map(u => fetch(u).then(r => r.ok ? r.json() : null)));
  let found = 0;
  for (const res of results) {
    if (res.status !== 'fulfilled' || !res.value) continue;
    const items = Array.isArray(res.value.member) ? res.value.member : [res.value];
    for (const item of items) {
      if (!item?.name || !item?.line1 || !item?.line2) continue;
      if (/DEB|OBJECT|R\/B/i.test(item.name)) continue;
      if (tleEpochAgeDays(item.line1) > 14) continue; // skip ended missions
      const pat = SPACECRAFT_PATTERNS.find(p => p.match(item.name));
      if (!pat || tleData[item.name]) continue;
      try { tleData[item.name] = { satrec: satellite.twoline2satrec(item.line1, item.line2), meta: pat, name: item.name }; found++; } catch(e) {}
    }
  }
  return found;
}

async function fetchTLEs() {
  try {
    if (typeof satellite === 'undefined') { addLog('satellite.js not loaded', 'err'); return; }
    // Try same-origin TLE file first (no CORS, updated by GitHub Actions)
    try {
      const res = await fetch('data/stations.tle', { cache: 'no-cache' });
      if (res.ok) {
        const text = await res.text();
        const found = parseTLEText(text);
        if (found > 0) {
          addLog(`Orbit: loaded ${found} spacecraft TLEs`, 'sys');
          clearSatLayers(); updateOrbits();
          // Supplement with all active docked/mission craft
          fetchActiveMissionTLEs().then(n => { if (n > 0) { addLog(`Orbit: +${n} active mission TLEs`, 'sys'); clearSatLayers(); updateOrbits(); } });
          return;
        }
      }
    } catch(e) {}
    // Fallback: Ivan TLE API (CORS-open, JSON)
    addLog('TLE: trying backup API…', 'sys');
    const found = await fetchTLEsFromIvanAPI();
    if (found > 0) { addLog(`Orbit: loaded ${found} spacecraft (backup API)`, 'sys'); clearSatLayers(); updateOrbits(); }
    else addLog('TLE: all sources failed', 'err');
  } catch(e) { addLog(`TLE error: ${e.message}`, 'err'); }
}

function propagateSat(satrec, date) {
  try {
    const pv = satellite.propagate(satrec, date);
    if (!pv?.position) return null;
    const gmst = satellite.gstime(date);
    const gd = satellite.eciToGeodetic(pv.position, gmst);
    return {
      lat: satellite.radiansToDegrees(gd.latitude),
      lon: satellite.radiansToDegrees(gd.longitude),
      alt: gd.height,
    };
  } catch(e) { return null; }
}

function splitAtAntimeridian(pts) {
  if (!pts.length) return [];
  const segs = [];
  let cur = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i][1] - pts[i-1][1]) > 180) {
      if (cur.length > 1) segs.push(cur);
      cur = [pts[i]];
    } else {
      cur.push(pts[i]);
    }
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

function computeGroundTrack(satrec) {
  const now = Date.now();
  const pts = [];
  for (let i = 0; i <= 92; i += 2) {
    const pos = propagateSat(satrec, new Date(now + i * 60000));
    if (pos) pts.push([pos.lat, pos.lon]);
  }
  return pts;
}

function scDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371, d2r = Math.PI/180;
  const dLat = (lat2-lat1)*d2r, dLon = (lon2-lon1)*d2r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Group spacecraft — stations get priority as cluster primaries.
// Affinity-based: longterm docked craft always nest under their home station regardless
// of TLE drift. Mission craft (Dragon, Cygnus) nest if within 2000km, otherwise standalone.
function clusterSpacecraft() {
  const positioned = Object.entries(S_spacecraft).filter(([,sc]) => sc.lat != null);
  const STATIONS = ['ISS (ZARYA)', 'CSS (TIANHE)'];
  const STATION_SET = new Set(STATIONS);
  // Which abbr values belong to which station (longterm docked)
  // Hard affinity: these craft only ever dock to one station
  const ISS_ABBR = new Set(['Soyuz', 'Progress', 'Dragon', 'Cygnus', 'HTV', 'Orion']);
  const CSS_ABBR = new Set(['Wentian', 'Mengtian', 'Shenzhou', 'Tianzhou']);
  const used = new Set();
  const clusters = [];

  // First pass: build station clusters
  for (const stName of STATIONS) {
    const st = S_spacecraft[stName];
    if (!st?.lat) continue;
    used.add(stName);
    const members = [stName];
    const isISS = stName === 'ISS (ZARYA)';
    for (const [other, osc] of positioned) {
      if (used.has(other)) continue;
      if (STATION_SET.has(other)) continue;
      const abbr = osc.abbr || '';
      // Longterm docked craft: always nest under their home station
      const alwaysISS = ISS_ABBR.has(abbr);
      const alwaysCSS = CSS_ABBR.has(abbr);
      if (isISS && alwaysISS) { members.push(other); used.add(other); continue; }
      if (!isISS && alwaysCSS) { members.push(other); used.add(other); continue; }
      if (alwaysISS || alwaysCSS) continue; // claimed by other station, skip
    }
    clusters.push({ primary: stName, members, longterm: true });
  }

  // Second pass: remaining (departed/independent) spacecraft as standalone
  for (const [name] of positioned) {
    if (used.has(name)) continue;
    used.add(name);
    const psc = S_spacecraft[name];
    clusters.push({ primary: name, members: [name], longterm: !!psc.longterm });
  }
  return clusters;
}

function removeSatMarker(name) {
  const marker = spacecraftMarkers[name];
  const track  = orbitTracks[name];
  if (marker) { [orbitLayer, rocketLayer].forEach(l => { if (l) try { l.removeLayer(marker); } catch(e) {} }); delete spacecraftMarkers[name]; }
  if (track)  { [orbitLayer, rocketLayer].forEach(l => { if (l) try { l.removeLayer(track);  } catch(e) {} }); delete orbitTracks[name]; }
}

function updateSpacecraftMarker(primary, members, layer) {
  const sc = S_spacecraft[primary];
  const col = sc.col || '#ffffff';
  const isStation = /^ISS|^CSS/.test(primary);
  const sz = isStation ? 22 : 16;
  const docked = members.filter(n => n !== primary);
  const svg = isStation
    ? `<svg width="${sz}" height="${sz}" viewBox="0 0 20 20">
        <rect x="8" y="8" width="4" height="4" fill="${col}"/>
        <line x1="0" y1="10" x2="8" y2="10" stroke="${col}" stroke-width="2"/>
        <line x1="12" y1="10" x2="20" y2="10" stroke="${col}" stroke-width="2"/>
        <line x1="10" y1="0" x2="10" y2="8" stroke="${col}" stroke-width="1.5" opacity="0.5"/>
        <line x1="10" y1="12" x2="10" y2="20" stroke="${col}" stroke-width="1.5" opacity="0.5"/>
      </svg>`
    : `<svg width="${sz}" height="${sz}" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="3.5" fill="${col}"/>
        <line x1="2" y1="10" x2="7" y2="10" stroke="${col}" stroke-width="1.5"/>
        <line x1="13" y1="10" x2="18" y2="10" stroke="${col}" stroke-width="1.5"/>
      </svg>`;
  const icon = L.divIcon({ html:svg, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], className:'' });
  const altStr = sc.alt ? ` · ${Math.round(sc.alt)} km` : '';
  const dockedHtml = docked.map(n => {
    const d = S_spacecraft[n]; if (!d) return '';
    return `<br><span style="color:${d.col||'#aaa'};font-size:10px">↳ ${esc(d.abbr||n)} · ${esc(d.operator)}</span>`;
  }).join('');
  const dockedBadge = docked.length ? ` <span style="font-size:9px;color:${col}88">(+${docked.length} docked)</span>` : '';
  const tip = `<b style="color:${col}">${esc(sc.abbr||primary)}${dockedBadge}</b><br>
    <span style="color:var(--t5)">${esc(sc.operator)}</span><br>${esc(sc.role)}${altStr}${dockedHtml}`;
  if (!spacecraftMarkers[primary]) {
    spacecraftMarkers[primary] = L.marker([sc.lat, sc.lon], {icon, zIndexOffset:800})
      .addTo(layer).on('click', () => showSpacecraftDetail(primary));
  } else {
    spacecraftMarkers[primary].setLatLng([sc.lat, sc.lon]);
    spacecraftMarkers[primary].setIcon(icon);
  }
  spacecraftMarkers[primary].bindTooltip(tip, {className:'ltt', direction:'auto'});
  // Ground track: past 45 min (solid) + next 90 min (dashed)
  if (tleData[primary]) {
    const nowMs = Date.now();
    const past = [], future = [];
    for (let i = -44; i <= 0; i += 2) {
      const pos = propagateSat(tleData[primary].satrec, new Date(nowMs + i * 60000));
      if (pos) past.push([pos.lat, pos.lon]);
    }
    for (let i = 0; i <= 92; i += 2) {
      const pos = propagateSat(tleData[primary].satrec, new Date(nowMs + i * 60000));
      if (pos) future.push([pos.lat, pos.lon]);
    }
    if (orbitTracks[primary]) { try { layer.removeLayer(orbitTracks[primary]); } catch(e) {} }
    const lines = [
      ...splitAtAntimeridian(past).map(seg   => L.polyline(seg, { color:col, weight:2,   opacity:0.55 })),
      ...splitAtAntimeridian(future).map(seg => L.polyline(seg, { color:col, weight:1.5, opacity:0.25, dashArray:'5 8' })),
    ];
    if (lines.length) orbitTracks[primary] = L.layerGroup(lines).addTo(layer);
  }
}

function clearSatLayers() {
  if (orbitLayer)  orbitLayer.clearLayers();
  if (rocketLayer) rocketLayer.clearLayers();
  for (const k in spacecraftMarkers) delete spacecraftMarkers[k];
  for (const k in orbitTracks)       delete orbitTracks[k];
}

function updateOrbits() {
  if (!map || !orbitLayer || !rocketLayer) return;
  const now = new Date();
  // Propagate all positions first; skip craft with implausible altitudes (re-entered or bad TLE)
  for (const [name, tle] of Object.entries(tleData)) {
    const pos = propagateSat(tle.satrec, now);
    if (!pos || pos.alt < 150 || pos.alt > 2200) continue;
    S_spacecraft[name] = { ...tle.meta, name, lat:pos.lat, lon:pos.lon, alt:pos.alt, incDeg: tle.satrec.inclo * (180/Math.PI) };
  }
  // Cluster and render one marker per cluster
  const clusters = clusterSpacecraft();
  const renderedPrimaries = new Set();
  for (const cluster of clusters) {
    // Non-primary cluster members get no individual marker
    cluster.members.forEach(n => { if (n !== cluster.primary) removeSatMarker(n); });
    if (cluster.longterm && !showSpacecraft) {
      removeSatMarker(cluster.primary);
      continue;
    }
    const layer = cluster.longterm ? orbitLayer : rocketLayer;
    updateSpacecraftMarker(cluster.primary, cluster.members, layer);
    renderedPrimaries.add(cluster.primary);
  }
  // Remove markers for spacecraft no longer in tleData (e.g. re-entered)
  Object.keys(spacecraftMarkers).forEach(name => {
    if (!name.startsWith('__') && !renderedPrimaries.has(name)) removeSatMarker(name);
  });
  updateBoosterProjections();
}

function toggleVessels() {
  showVessels = !showVessels;
  if (showVessels) layers.addTo(map); else map.removeLayer(layers);
  const btn = document.getElementById('vessels-btn');
  if (btn) btn.style.opacity = showVessels ? '1' : '0.4';
  renderFleet();
}
function toggleAircraft() {
  showAircraft = !showAircraft;
  if (showAircraft) aircraftLayer.addTo(map); else map.removeLayer(aircraftLayer);
  const btn = document.getElementById('aircraft-btn');
  if (btn) btn.style.opacity = showAircraft ? '1' : '0.4';
  renderFleet();
}
function toggleSpacecraft() {
  showSpacecraft = !showSpacecraft;
  const btn = document.getElementById('spacecraft-btn');
  if (btn) btn.style.opacity = showSpacecraft ? '1' : '0.4';
  if (showSpacecraft && !Object.keys(tleData).length) {
    addLog('Spacecraft: no TLE data loaded — retrying Celestrak…', 'err');
    fetchTLEs();
  }
  updateOrbits();
  renderFleet();
}

// ── Day/night terminator ───────────────────────────────────────
function updateTerminator() {
  if (!map || !terminatorLayer) return;
  terminatorLayer.clearLayers();
  const now = new Date();
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const decl = -23.45 * Math.cos(2 * Math.PI / 365 * (doy + 10));
  const declRad = decl * Math.PI / 180;
  const utcH = now.getUTCHours() + now.getUTCMinutes()/60 + now.getUTCSeconds()/3600;
  const subSolarLon = (12 - utcH) * 15;
  const pts = [];
  for (let lon = -180; lon <= 180; lon += 1) {
    const lonRad = (lon - subSolarLon) * Math.PI / 180;
    const lat = Math.atan(-Math.cos(lonRad) / Math.tan(declRad)) * 180 / Math.PI;
    pts.push([lat, lon]);
  }
  const pole = decl > 0 ? -90 : 90;
  L.polygon([...pts, [pole, 180], [pole, -180]], {
    color:'transparent', fillColor:'#000820', fillOpacity:0.42, interactive:false
  }).addTo(terminatorLayer);
  L.polyline(pts, { color:'#ffdd88', weight:1, opacity:0.35, dashArray:'3 5', interactive:false }).addTo(terminatorLayer);
}

// ── Mission arc ────────────────────────────────────────────────
function greatCircleArc(lat1,lon1,lat2,lon2,steps=60) {
  const r=Math.PI/180;
  const φ1=lat1*r, λ1=lon1*r, φ2=lat2*r, λ2=lon2*r;
  const d=2*Math.asin(Math.sqrt(Math.sin((φ2-φ1)/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin((λ2-λ1)/2)**2));
  if(d<0.0001) return [[lat1,lon1],[lat2,lon2]];
  const pts=[];
  for(let i=0;i<=steps;i++){
    const f=i/steps;
    const A=Math.sin((1-f)*d)/Math.sin(d), B=Math.sin(f*d)/Math.sin(d);
    const x=A*Math.cos(φ1)*Math.cos(λ1)+B*Math.cos(φ2)*Math.cos(λ2);
    const y=A*Math.cos(φ1)*Math.sin(λ1)+B*Math.cos(φ2)*Math.sin(λ2);
    const z=A*Math.sin(φ1)+B*Math.sin(φ2);
    pts.push([Math.atan2(z,Math.sqrt(x*x+y*y))/r, Math.atan2(y,x)/r]);
  }
  return pts;
}

function addArcLines(layer, pts, style) {
  splitAtAntimeridian(pts).forEach(seg => {
    if (seg.length > 1) L.polyline(seg, {...style, interactive:false}).addTo(layer);
  });
}

// ── Orbital trajectory helpers ────────────────────────────────
// Derive inclination from orbit type + mission context
function orbitInclination(orbit, padLat, missionName) {
  const abbrev = (orbit?.abbrev || '').toUpperCase();
  const name   = (orbit?.name   || '').toUpperCase();
  const mName  = (missionName   || '').toUpperCase();
  if (abbrev === 'ISS' || name.includes('SPACE STATION')) return 51.6;
  if (abbrev === 'CSS' || name.includes('TIANGONG'))      return 41.5;
  if (abbrev === 'SSO' || name.includes('SUN-SYNC') || name.includes('SUN SYNC')) return 97.8;
  if (abbrev === 'POLAR' || name.includes('POLAR ORBIT')) return 90;
  if (abbrev === 'GTO' || abbrev === 'GEO' || name.includes('TRANSFER')) return Math.max(Math.abs(padLat) + 1, 27);
  if (mName.includes('STARLINK')) return (Math.abs(padLat) > 33) ? 97.8 : 53;
  if (mName.includes('GPS') || mName.includes('NAVSTAR')) return 55;
  if (abbrev === 'LEO' || abbrev === 'MEO') return Math.max(Math.abs(padLat) + 8, 40);
  return Math.max(Math.abs(padLat) + 5, 28);
}

// Launch azimuth (deg true north) from pad latitude and target inclination
function launchAzimuth(padLat, inc) {
  const sinβ = Math.cos(inc * Math.PI/180) / Math.cos(padLat * Math.PI/180);
  if (Math.abs(sinβ) > 1) return 90; // equatorial fallback
  let β = Math.asin(Math.min(1, Math.max(-1, sinβ))) * 180/Math.PI;
  if (inc > 90) β = 180 - β; // retrograde orbits go south
  return ((β % 360) + 360) % 360;
}

// Compute ground track waypoints along a constant initial azimuth (geodesic)
function groundTrackPts(lat0, lon0, azDeg, steps, stepKm) {
  const pts = [[lat0, lon0]];
  let φ = lat0 * Math.PI/180, λ = lon0 * Math.PI/180;
  const β = azDeg * Math.PI/180;
  for (let n = 0; n < steps; n++) {
    const d = stepKm / 6371;
    const φ2 = Math.asin(Math.sin(φ)*Math.cos(d) + Math.cos(φ)*Math.sin(d)*Math.cos(β));
    const Δλ = Math.atan2(Math.sin(β)*Math.sin(d)*Math.cos(φ), Math.cos(d) - Math.sin(φ)*Math.sin(φ2));
    φ = φ2; λ = λ + Δλ;
    pts.push([φ*180/Math.PI, (((λ*180/Math.PI) + 180) % 360) - 180]);
  }
  return pts;
}

function getMissionArcs(launch, isHot) {
  const lspName    = launch.launch_service_provider?.name || '';
  const padName    = (launch.pad?.name || '') + ' ' + (launch.pad?.location?.name || '');
  const missionName = launch.mission?.name || launch.name || '';
  const orbit      = launch.mission?.orbit;
  const op = isHot ? 0.75 : 0.45;
  const w  = isHot ? 2.0  : 1.5;
  const da = isHot ? '8 4' : '5 8';
  let padCoords = null, arcs = [];

  if (lspName.includes('SpaceX')) {
    if (/Starbase|Boca Chica/i.test(padName)) {
      padCoords = LAUNCH_PADS['starbase'];
      // Starship booster: east into Gulf, boostback to Mechazilla
      const boosterWpts = [
        [padCoords.lat, padCoords.lon],
        [26.8,-95.5],[26.5,-93.5],[26.0,-95.0],[25.9,-97.1]
      ];
      // Ship: east then orbital insertion, through Caribbean/Atlantic/Indian Ocean
      const shipWpts = [
        [padCoords.lat, padCoords.lon],
        [25.5,-90.0],[24.0,-80.0],[21.0,-70.0],
        [17.0,-58.0],[12.0,-42.0],[7.0,-22.0],
        [2.0,0.0],[-4.0,22.0],[-10.0,50.0],[-15.0,80.0]
      ];
      arcs = [
        { pts:boosterWpts, style:{color:'#ff8800',weight:w,opacity:op,dashArray:da} },
        { pts:shipWpts,    style:{color:'#44aaff',weight:w,opacity:op,dashArray:da} },
      ];
    } else if (/Vandenberg|SLC-4/i.test(padName)) {
      padCoords = LAUNCH_PADS['slc4e'];
      const inc   = orbitInclination(orbit, padCoords.lat, missionName);
      const az    = launchAzimuth(padCoords.lat, inc);
      const sepPt = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 300)[1];
      const dsPt  = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 650)[1];
      const dsV   = S.vessels['368351350'];
      const ocisly = dsV?.lat ? {lat:dsV.lat,lon:dsV.lon} : {lat:dsPt[0],lon:dsPt[1]};
      const upperEndPt = groundTrackPts(sepPt[0], sepPt[1], az, 8, 200); // 1600km upper stage arc
      arcs = [
        { pts:groundTrackPts(padCoords.lat,padCoords.lon,az,6,50),          style:{color:'#ff8800',weight:w,opacity:op,  dashArray:da} },
        { pts:greatCircleArc(sepPt[0],sepPt[1],ocisly.lat,ocisly.lon),      style:{color:'#ff4444',weight:w,opacity:op*.9,dashArray:da} },
        { pts:upperEndPt,                                                     style:{color:'#44aaff',weight:w,opacity:op,  dashArray:da} },
      ];
    } else {
      padCoords = /LC-39A/i.test(padName) ? LAUNCH_PADS['lc39a'] : LAUNCH_PADS['slc40'];
      const inc   = orbitInclination(orbit, padCoords.lat, missionName);
      const az    = launchAzimuth(padCoords.lat, inc);
      const sepPt = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 350)[1];
      const dsPt  = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 700)[1];
      const dsE   = S.vessels['368219910'];
      const asog  = dsE?.lat ? {lat:dsE.lat,lon:dsE.lon} : {lat:dsPt[0],lon:dsPt[1]};
      const upperEndPt = groundTrackPts(sepPt[0], sepPt[1], az, 10, 200); // 2000km upper stage arc
      arcs = [
        { pts:groundTrackPts(padCoords.lat,padCoords.lon,az,7,50),           style:{color:'#ff8800',weight:w,opacity:op,  dashArray:da} },
        { pts:greatCircleArc(sepPt[0],sepPt[1],asog.lat,asog.lon),           style:{color:'#ff4444',weight:w,opacity:op*.9,dashArray:da} },
        { pts:upperEndPt,                                                      style:{color:'#44aaff',weight:w,opacity:op,  dashArray:da} },
      ];
    }
  } else if (lspName.includes('Blue Origin')) {
    padCoords = LAUNCH_PADS['lc36'];
    const inc  = orbitInclination(orbit, padCoords.lat, missionName);
    const az   = launchAzimuth(padCoords.lat, inc);
    const dsNG = S.vessels['368368960'];
    const dsPt = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 700)[1];
    const jacklyn = dsNG?.lat ? {lat:dsNG.lat,lon:dsNG.lon} : {lat:dsPt[0],lon:dsPt[1]};
    arcs = [
      { pts:groundTrackPts(padCoords.lat,padCoords.lon,az,6,50),           style:{color:'#44ccff',weight:w,opacity:op,dashArray:da} },
      { pts:greatCircleArc(dsPt[0],dsPt[1],jacklyn.lat,jacklyn.lon),       style:{color:'#4488ff',weight:w,opacity:op*.9,dashArray:da} },
    ];
  } else if (lspName.includes('Rocket Lab')) {
    const rlPad = /LC-2|Wallops/i.test(padName) ? LAUNCH_PADS['rl_wallops'] : LAUNCH_PADS['mahia'];
    padCoords = rlPad || LAUNCH_PADS['mahia'];
    const inc = orbitInclination(orbit, padCoords.lat, missionName);
    const az  = launchAzimuth(padCoords.lat, inc);
    arcs = [
      { pts:groundTrackPts(padCoords.lat,padCoords.lon,az,10,150), style:{color:'#ff3355',weight:w,opacity:op,dashArray:da} },
    ];
  }
  return { padCoords, arcs };
}

function drawTrajectoryArcs(launch, isHot) {
  if (!map || !missionArcLayer) return;
  missionArcLayer.clearLayers();
  if (!launch) return;
  const { padCoords, arcs } = getMissionArcs(launch, isHot);
  if (!padCoords || !arcs.length) return;
  arcs.forEach(a => addArcLines(missionArcLayer, a.pts, a.style));
  L.circleMarker([padCoords.lat, padCoords.lon], {
    radius:5, color:'#ff8800', fillColor:'#ff8800', fillOpacity:0.9, weight:2, interactive:false
  }).addTo(missionArcLayer)
    .bindTooltip(`<b>${esc(launch.name)}</b><br>${esc(launch.pad?.name||'')}`, {className:'ltt', direction:'auto'});
}

function updateTrajectoryArcs() {
  if (!map || !missionArcLayer) return;
  if (selectedMissionForArc) {
    drawTrajectoryArcs(selectedMissionForArc, false);
    return;
  }
  const now = Date.now();
  const active = [...missionsCache, ...pastMissionsCache].find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if (!net) return false;
    const el = now - net;
    return el > -3*3600000 && el < 30*60000;
  });
  if (!active) { missionArcLayer.clearLayers(); return; }
  const isHot = now - new Date(active.net).getTime() > -5*60000;
  drawTrajectoryArcs(active, isHot);
}

function showMissionArc(id) {
  const launch = _missionById[id];
  if (!launch) return;
  selectedMissionForArc = launch;
  drawTrajectoryArcs(launch, false);
  document.getElementById('missions-panel').style.display = 'none';
  const { padCoords } = getMissionArcs(launch, false);
  if (padCoords) map.setView([padCoords.lat, padCoords.lon], 4);
}

function clearMissionArc() {
  selectedMissionForArc = null;
  if (missionArcLayer) missionArcLayer.clearLayers();
}

function toggleRightPanel() {
  const right = document.getElementById('right');
  const btn   = document.getElementById('rpanel-toggle');
  const col   = right.classList.toggle('collapsed');
  btn.title = col ? 'Show panel' : 'Hide panel';
  setTimeout(() => { if(map) map.invalidateSize(); }, 160);
}

// ── Booster projection ─────────────────────────────────────────
function updateBoosterProjections() {
  if (!rocketLayer) return;
  const now = Date.now();
  // Find any launch within T-5min to T+90min
  const active = [...missionsCache, ...pastMissionsCache].find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if (!net) return false;
    const el = now - net;
    return el > -5*60000 && el < 90*60000;
  });
  const key = '__booster__';
  const shipKey = '__ship__';
  if (!active) {
    [key, shipKey].forEach(k => {
      if (spacecraftMarkers[k]) { try { rocketLayer.removeLayer(spacecraftMarkers[k]); } catch(e) {} delete spacecraftMarkers[k]; }
    });
    return;
  }
  const net = new Date(active.net).getTime();
  const elapsed = (now - net) / 1000;
  const lspName = active.launch_service_provider?.name || '';
  const padName  = (active.pad?.name || '') + ' ' + (active.pad?.location?.name || '');

  let prof = null, padCoords = null, boosterTarget = null;
  if (lspName.includes('SpaceX')) {
    if (/Starbase|Boca Chica/i.test(padName)) {
      prof = BOOSTER_PROFILES['Starship'];
      padCoords = LAUNCH_PADS['starbase'];
      boosterTarget = prof.boosterTarget;
    } else if (/Vandenberg|SLC-4/i.test(padName)) {
      prof = BOOSTER_PROFILES['Falcon 9'];
      padCoords = LAUNCH_PADS['slc4e'];
      const ds = S.vessels['368351350']; boosterTarget = ds?.lat ? {lat:ds.lat,lon:ds.lon} : {lat:32.5,lon:-122.0};
    } else {
      prof = BOOSTER_PROFILES['Falcon 9'];
      padCoords = /LC-39A/i.test(padName) ? LAUNCH_PADS['lc39a'] : LAUNCH_PADS['slc40'];
      const ds = S.vessels['368219910']; boosterTarget = ds?.lat ? {lat:ds.lat,lon:ds.lon} : {lat:30.5,lon:-76.5};
    }
  } else if (lspName.includes('Blue Origin')) {
    prof = BOOSTER_PROFILES['New Glenn'];
    padCoords = LAUNCH_PADS['lc36'];
    const ds = S.vessels['368368960']; boosterTarget = ds?.lat ? {lat:ds.lat,lon:ds.lon} : {lat:30.0,lon:-77.5};
  } else if (lspName.includes('Rocket Lab')) {
    prof = BOOSTER_PROFILES['Electron'];
    padCoords = LAUNCH_PADS['mahia'];
    boosterTarget = {lat:-39.5, lon:179.5};
  }

  if (!prof || !padCoords || !boosterTarget) return;

  // Project booster position
  if (elapsed >= 0 && elapsed <= prof.boosterSecs) {
    const frac = elapsed / prof.boosterSecs;
    const lat = padCoords.lat + (boosterTarget.lat - padCoords.lat) * frac;
    const lon = padCoords.lon + (boosterTarget.lon - padCoords.lon) * frac;
    const tStr = `T+${Math.floor(elapsed/60)}:${String(Math.round(elapsed%60)).padStart(2,'0')}`;
    const col = '#ff8800';
    const svg = `<svg width="18" height="18" viewBox="0 0 20 20">
      <polygon points="10,2 13,10 10,8 7,10" fill="${col}"/>
      <circle cx="10" cy="14" r="2.5" fill="none" stroke="${col}" stroke-width="1.2"/>
    </svg>`;
    const icon = L.divIcon({html:svg, iconSize:[18,18], iconAnchor:[9,9], className:''});
    if (!spacecraftMarkers[key]) {
      spacecraftMarkers[key] = L.marker([lat,lon], {icon, zIndexOffset:1200}).addTo(rocketLayer);
    } else { spacecraftMarkers[key].setLatLng([lat,lon]); spacecraftMarkers[key].setIcon(icon); }
    spacecraftMarkers[key].bindTooltip(
      `<b style="color:${col}">BOOSTER · ${esc(active.name||'')}</b><br>
      <span style="color:var(--t4)">Estimated · ${tStr} · ~${Math.round(frac*100)}% to landing</span>`,
      {className:'ltt', direction:'auto'});
  } else if (elapsed > prof.boosterSecs) {
    if (spacecraftMarkers[key]) { try { rocketLayer.removeLayer(spacecraftMarkers[key]); } catch(e) {} delete spacecraftMarkers[key]; }
  }

  // Project Starship Ship position
  if (prof === BOOSTER_PROFILES['Starship'] && elapsed > 0 && elapsed <= prof.shipSecs) {
    const frac = elapsed / prof.shipSecs;
    const lat = padCoords.lat + (prof.shipTarget.lat - padCoords.lat) * frac;
    const lon = padCoords.lon + (prof.shipTarget.lon - padCoords.lon) * frac;
    const tStr = `T+${Math.floor(elapsed/60)}:${String(Math.round(elapsed%60)).padStart(2,'0')}`;
    const col = '#00d4ff';
    const svg = `<svg width="18" height="18" viewBox="0 0 20 20">
      <polygon points="10,2 14,18 10,14 6,18" fill="${col}"/>
    </svg>`;
    const icon = L.divIcon({html:svg, iconSize:[18,18], iconAnchor:[9,9], className:''});
    if (!spacecraftMarkers[shipKey]) {
      spacecraftMarkers[shipKey] = L.marker([lat,lon], {icon, zIndexOffset:1200}).addTo(rocketLayer);
    } else { spacecraftMarkers[shipKey].setLatLng([lat,lon]); spacecraftMarkers[shipKey].setIcon(icon); }
    spacecraftMarkers[shipKey].bindTooltip(
      `<b style="color:${col}">STARSHIP SHIP · ${esc(active.name||'')}</b><br>
      <span style="color:var(--t4)">Estimated · ${tStr}</span>`,
      {className:'ltt', direction:'auto'});
  }
}

// ── Spacecraft detail panel ────────────────────────────────────
function showSpacecraftDetail(name) {
  S.selectedSpacecraft = name;
  const sc = S_spacecraft[name];
  if (sc?.lat && sc?.lon && map) map.setView([sc.lat, sc.lon], 3);
  S.tab = 'spacecraft';
  ['events','vessel','history','log'].forEach(id => {
    document.getElementById('rtab-'+id).classList.toggle('act', false);
  });
  document.getElementById('rtab-vessel').classList.add('act');
  renderRight();
}

function buildSpacecraftDetail() {
  const name = S.selectedSpacecraft;
  if (!name || !S_spacecraft[name]) return '<div style="padding:16px;color:var(--t4);font-size:12px">No spacecraft selected.</div>';
  const sc = S_spacecraft[name];
  const col = sc.col || '#fff';
  const alt = sc.alt ? `${Math.round(sc.alt)} km` : '—';
  const pos = sc.lat != null ? `${sc.lat.toFixed(2)}°, ${sc.lon.toFixed(2)}°` : '—';
  const info = STATION_INFO[name];

  let modulesHtml = '';
  let dockedHtml = '';

  if (info) {
    // Permanent modules section
    if (info.modules.length) {
      modulesHtml = `
        <div style="margin-top:14px">
          <div style="font-size:9px;letter-spacing:.1em;color:var(--t4);margin-bottom:6px">PERMANENT MODULES</div>
          ${info.modules.map(m => `
            <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
              <div style="width:6px;height:6px;border-radius:50%;background:${m.col};margin-top:3px;flex-shrink:0"></div>
              <div>
                <div style="font-size:12px;color:${m.col};font-weight:600">${esc(m.name)}</div>
                <div style="font-size:10px;color:var(--t3)">${esc(m.role)}</div>
                <div style="font-size:10px;color:var(--t4)">${esc(m.location)}</div>
              </div>
            </div>`).join('')}
        </div>`;
    }

    // Docked visiting vehicles from manifest
    const docked = dockedManifest[name] || [];
    if (docked.length) {
      dockedHtml = `
        <div style="margin-top:14px">
          <div style="font-size:9px;letter-spacing:.1em;color:var(--t4);margin-bottom:6px">VISITING SPACECRAFT</div>
          ${docked.map(d => {
            const hint = (info.visitingNotes || []).find(r => r.match.test(d.name)) || {};
            return `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px">
              <div style="width:6px;height:6px;border-radius:50%;background:${d.col||'#888'};margin-top:3px;flex-shrink:0"></div>
              <div>
                <div style="font-size:12px;color:${d.col||'#ccc'};font-weight:600">${esc(d.name)}</div>
                <div style="font-size:10px;color:var(--t3)">${esc(d.operator)}${hint.location ? ' · ' + hint.location : ''}</div>
                ${hint.note ? `<div style="font-size:10px;color:var(--t4);margin-top:1px">${esc(hint.note)}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>`;
    }
  }

  return `<div style="padding:14px 16px">
    <div style="font-size:18px;font-weight:700;color:${col};letter-spacing:.04em;margin-bottom:2px">${esc(info?.fullName || name)}</div>
    <div style="font-size:11px;color:var(--t4);margin-bottom:12px">${esc(info?.agency || sc.operator)} · ${esc(sc.role)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${stat('STATUS','IN ORBIT','#00ff88')}
      ${stat('ALTITUDE',alt,'var(--t2)')}
      ${stat('POSITION',pos,'var(--t2)')}
      ${stat('INCLINATION', sc.incDeg != null ? sc.incDeg.toFixed(1)+'°' : 'LEO', 'var(--t3)')}
    </div>
    ${modulesHtml}
    ${dockedHtml}
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <a href="https://heavens-above.com/orbit.aspx" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none">HEAVENS-ABOVE ↗</a>
      <a href="https://www.n2yo.com" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none">N2YO ↗</a>
    </div>
  </div>`;
}

function buildSpacecraftRow(cluster) {
  const sc = S_spacecraft[cluster.primary];
  if (!sc || sc.lat == null) return '';
  const col = sc.col || '#fff';
  // Use Space Devs authoritative docking manifest when available, fall back to TLE cluster members
  const manifestDocked = dockedManifest[cluster.primary];
  const docked = manifestDocked
    ? manifestDocked
    : cluster.members.filter(n => n !== cluster.primary).map(n => S_spacecraft[n]).filter(Boolean);
  const dockedHtml = docked.map(d => {
    if (!d) return '';
    return `<div style="display:flex;align-items:center;gap:5px;padding-left:10px;margin-top:1px">
      <div style="width:5px;height:5px;border-radius:50%;background:${d.col||'#888'};flex-shrink:0"></div>
      <span style="font-size:10px;color:${d.col||'#888'}">${esc(d.abbr||d.name||'')}</span>
      <span style="font-size:10px;color:var(--t4)">${esc(d.operator)} · docked</span>
    </div>`;
  }).join('');
  const badge = docked.length ? ` <span style="font-size:9px;font-weight:400;color:${col}77">+${docked.length}</span>` : '';
  return `<div class="vrow" data-sc="${esc(cluster.primary)}" style="border-left-color:${col};background:rgba(0,200,255,.03)">
    <div class="vn" style="color:${col};text-shadow:0 0 8px ${col}44">${esc(sc.abbr||cluster.primary)}${badge}</div>
    <div class="vop" style="color:${col}77">${esc(sc.operator)} · ${esc(sc.role)}</div>
    ${dockedHtml}
    <div class="vbottom">
      <div class="vdot" style="background:#00ff88;box-shadow:0 0 5px #00ff8888"></div>
      <span style="color:#00ff88;font-size:10px;font-weight:700">IN ORBIT</span>
      ${sc.alt ? `<span style="color:var(--t4);font-size:10px;margin-left:4px">${Math.round(sc.alt)} km${sc.incDeg != null ? ` · ${sc.incDeg.toFixed(1)}°` : ''}</span>` : ''}
    </div>
  </div>`;
}

// ── WebSocket ─────────────────────────────────────────────────
function toggleConnect() {
  if(S.ws){disconnect();return;}
  const key=localStorage.getItem(LS.KEY);
  if(!key){showSettings();return;}
  connect(key);
}

let _aisReconnectDelay = 10000; // backoff: 10s → 20s → 40s → ... → 120s max
let _aisReconnectTimer = null;
let _aisManualDisconnect = false;

function scheduleAISReconnect() {
  if (_aisReconnectTimer || _aisManualDisconnect) return;
  const key = localStorage.getItem(LS.KEY);
  if (!key) return;
  const secs = Math.round(_aisReconnectDelay / 1000);
  setDot('off', `Reconnecting in ${secs}s…`);
  addLog(`AIS: reconnecting in ${secs}s`, 'sys');
  _aisReconnectTimer = setTimeout(() => { _aisReconnectTimer = null; connect(key); }, _aisReconnectDelay);
  _aisReconnectDelay = Math.min(_aisReconnectDelay * 2, 120000);
}

function connect(key) {
  setDot('connecting','Connecting to aisstream.io…');
  addLog('Connecting to aisstream.io…', 'sys');
  const btn=document.getElementById('cbtn');
  btn.textContent='…'; btn.disabled=true;
  const timeout=setTimeout(()=>{
    setDot('off','Timeout — check key & network');
    addLog('Connection timeout','err');
    btn.textContent='CONNECT'; btn.disabled=false;
    scheduleAISReconnect();
  },8000);
  const ws=new WebSocket('wss://stream.aisstream.io/v0/stream');
  ws.onopen=()=>{
    clearTimeout(timeout);
    _aisReconnectDelay = 10000; // reset backoff on success
    _aisManualDisconnect = false;
    ws.send(JSON.stringify({
      APIKey:key, BoundingBoxes:[[[-90,-180],[90,180]]],
      FiltersShipMMSI:KNOWN_MMSIS, FilterMessageTypes:['PositionReport','ShipStaticData'],
    }));
    S.ws=ws; btn.textContent='DISCONNECT'; btn.disabled=false; btn.classList.add('on');
    setDot('on','● LIVE');
    addLog(`AIS connected — subscribed to ${KNOWN_MMSIS.length} MMSIs globally`, 'ais');
  };
  ws.onmessage=async ev=>{
    try{
      const text=ev.data instanceof Blob?await ev.data.text():ev.data;
      const msg=JSON.parse(text);
      const rawMMSI=msg.MetaData?.MMSI_String||msg.MetaData?.MMSI||'';
      if(rawMMSI&&!VESSEL_DB[String(rawMMSI)]) addLog(`AIS rcv unknown MMSI ${rawMMSI}`, 'ais');
      handleAIS(msg);
    }catch(e){addLog(`AIS parse error: ${e.message}`,'err');}
  };
  ws.onclose=ev=>{
    clearTimeout(timeout);
    S.ws=null; btn.textContent='CONNECT'; btn.disabled=false; btn.classList.remove('on');
    const badKey = ev.code===4001||ev.code===4003;
    setDot('off', badKey ? 'Invalid API key — check ⚙ SETTINGS' : `Disconnected (${ev.code})`);
    addLog(`AIS ${badKey?'invalid key':'disconnected'} (code ${ev.code})`, badKey?'err':'sys');
    if (!badKey) scheduleAISReconnect();
  };
  ws.onerror=()=>{clearTimeout(timeout);setDot('off','Connection error');addLog('AIS WebSocket error','err');};
}

function disconnect() {
  _aisManualDisconnect = true;
  if (_aisReconnectTimer) { clearTimeout(_aisReconnectTimer); _aisReconnectTimer = null; }
  if(S.ws){S.ws.close();S.ws=null;}
  Object.values(markers).forEach(m=>{try{layers?.removeLayer(m);}catch(e){}});
  Object.values(tracks).forEach(t=>{try{layers?.removeLayer(t);}catch(e){}});
  for(const k in markers)delete markers[k];
  for(const k in tracks)delete tracks[k];
  Object.keys(S.vessels).forEach(mmsi=>{
    if(!S.vessels[mmsi]._historical) delete S.vessels[mmsi];
  });
  document.getElementById('cbtn').textContent='CONNECT';
  document.getElementById('cbtn').classList.remove('on');
  setDot('off','Disconnected');
  renderFleet(); renderRight();
}

function setDot(state,msg){
  document.getElementById('pdot').className='pulse-dot '+state;
  document.getElementById('cstatus').textContent=msg;
}

// ── Settings modal ────────────────────────────────────────────
function showSettings() {
  const modal=document.getElementById('settingsmodal');
  modal.style.display='flex';
  modal.onclick=e=>{if(e.target===modal)closeSettings();};
  const k=localStorage.getItem(LS.KEY)||'';
  document.getElementById('key-input').value=k?'•'.repeat(20):'';
  document.getElementById('sb-url-input').value=localStorage.getItem(LS.SB_URL)||'';
  const sk=localStorage.getItem(LS.SB_AKEY)||'';
  document.getElementById('sb-key-input').value=sk?'•'.repeat(20):'';
  document.getElementById('settings-msg').textContent='';
  loadSuggestions();
}
function closeSettings(){document.getElementById('settingsmodal').style.display='none';}

function saveSettings() {
  const keyVal  =document.getElementById('key-input').value.trim();
  const sbUrl   =document.getElementById('sb-url-input').value.trim();
  const sbKeyVal=document.getElementById('sb-key-input').value.trim();
  if(keyVal   &&!keyVal.startsWith('•'))    localStorage.setItem(LS.KEY,    keyVal);
  if(sbUrl)                                  localStorage.setItem(LS.SB_URL, sbUrl);
  if(sbKeyVal &&!sbKeyVal.startsWith('•'))  localStorage.setItem(LS.SB_AKEY,sbKeyVal);
  document.getElementById('settings-msg').textContent='Saved ✓';
  setTimeout(closeSettings,600);

  const newKey=localStorage.getItem(LS.KEY);
  if(newKey){if(S.ws)disconnect();connect(newKey);}
  SB.init();
  loadSBData();
}

document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.getElementById('settingsmodal').style.display!=='none') saveSettings();
  if(e.key==='Escape'){ closeSettings(); closeSuggestModal(); closeSources(); }
});

// ── Header stats ──────────────────────────────────────────────
const _cycleIdx={};
function cycleVessels(mmsis, key) {
  if(!mmsis.length) return;
  _cycleIdx[key] = ((_cycleIdx[key]||0) % mmsis.length);
  selectVessel(mmsis[_cycleIdx[key]]);
  _cycleIdx[key]++;
}
function cycleAircraft(regs, key) {
  if(!regs.length) return;
  _cycleIdx[key] = ((_cycleIdx[key]||0) % regs.length);
  showAircraftDetail(regs[_cycleIdx[key]]);
  _cycleIdx[key]++;
}
function cycleSpacecraft() {
  const primaries = clusterSpacecraft().filter(c=>S_spacecraft[c.primary]?.lat!=null).map(c=>c.primary);
  if(!primaries.length) return;
  _cycleIdx['sc'] = ((_cycleIdx['sc']||0) % primaries.length);
  showSpacecraftDetail(primaries[_cycleIdx['sc']]);
  _cycleIdx['sc']++;
}

function updateHeaderStats(){
  const now=Date.now();
  const safeArr=a=>JSON.stringify(a).replace(/"/g,"'");
  let rows;
  if(SHARE_MODE) {
    const STALE=14*24*3600000;
    const tracked=Object.values(S.vessels).filter(v=>v.lat&&v.ts&&(now-v.ts<STALE));
    const underway=tracked.filter(v=>v.sog!=null&&v.sog>0.5&&!isNearPort(v.lat,v.lon));
    const stationary=tracked.filter(v=>!underway.includes(v));
    const airborneRegs=Object.keys(AIRCRAFT_DB).filter(r=>{const ac=S.aircraft[r];return ac&&!ac._stale&&ac.alt!=='ground';});
    const orbitingSC2=clusterSpacecraft().filter(c=>S_spacecraft[c.primary]?.lat!=null).length;
    const underwayMMSIs=underway.map(v=>v.mmsi);
    const stationaryMMSIs=stationary.map(v=>v.mmsi);
    rows=[
      [underway.length,  'UNDERWAY',  '#00ff88',`cycleVessels(${safeArr(underwayMMSIs)},'underway')`,'MARINE ASSETS'],
      [stationary.length,'STATIONARY','#338855',`cycleVessels(${safeArr(stationaryMMSIs)},'stationary')`,'MARINE ASSETS'],
      [airborneRegs.length,'AIRBORNE ASSETS','#ffcc00',`cycleAircraft(${safeArr(airborneRegs)},'airborne')`],
      [orbitingSC2,'SPACE ASSETS','#00d4ff','cycleSpacecraft()'],
    ];
  } else {
    const live=Object.values(S.vessels).filter(v=>v.lat&&!v._vapi&&v.ts&&(now-v.ts<600000));
    const moving=live.filter(v=>v.sog>0.5).length;
    const liveMMSIs    =live.map(v=>v.mmsi);
    const underwayMMSIs=live.filter(v=>v.sog>0.5).map(v=>v.mmsi);
    const airborneRegs =Object.keys(AIRCRAFT_DB).filter(r=>{ const ac=S.aircraft[r]; return ac&&!ac._stale&&ac.alt!=='ground'; });
    const orbitingSC   =clusterSpacecraft().filter(c=>S_spacecraft[c.primary]?.lat!=null).length;
    const stationaryMMSIs=live.filter(v=>v.sog<=0.5).map(v=>v.mmsi);
    rows=[
      [moving,             'UNDERWAY',  '#00ff88',`cycleVessels(${safeArr(underwayMMSIs)},'underway')`,'MARINE ASSETS'],
      [live.length-moving, 'STATIONARY','#338855',`cycleVessels(${safeArr(stationaryMMSIs)},'stationary')`,'MARINE ASSETS'],
      [airborneRegs.length,'AIRBORNE ASSETS','#ffcc00',`cycleAircraft(${safeArr(airborneRegs)},'airborne')`],
      [orbitingSC,         'SPACE ASSETS',  '#00d4ff','cycleSpacecraft()'],
    ];
    if(S.ws) {
      const parts=[`${KNOWN_MMSIS.length} vessels`];
      if(Object.keys(S.aircraft||{}).length) parts.push(`${Object.keys(S.aircraft).length} aircraft`);
      if(orbitingSC) parts.push(`${orbitingSC} spacecraft`);
      document.getElementById('cstatus').textContent='● LIVE — '+parts.join(' · ');
    }
  }
  document.getElementById('hstats').innerHTML=rows
    .map(([v,l,c,fn,grp])=>`<div onclick="${fn||''}" style="cursor:${v>0&&fn?'pointer':'default'};text-align:center" title="${l}">
      <div class="sv" style="color:${c}">${v}</div>
      <div class="sl" style="text-decoration:${v>0&&fn?'underline':'none'};text-underline-offset:2px">${l}</div>
      ${grp?`<div style="font-size:8px;color:var(--t5);letter-spacing:.06em;margin-top:1px">${grp}</div>`:''}
    </div>`).join('');
}

// ── Operator legend ───────────────────────────────────────────
function renderOpLegend(){}

// ── Fleet roster ──────────────────────────────────────────────
function renderFleet(){
  const now2=Date.now();
  const lc=Object.values(S.vessels).filter(v=>v.lat&&!v._historical&&v.ts&&(now2-v.ts<600000)).length;
  const total=KNOWN_MMSIS.length;
  document.getElementById('lhdr').textContent=S.ws?`FLEET · ${lc} LIVE · ${total-lc} OFFLINE`:'FLEET ROSTER';
  const STALE_14D = 14*24*3600000;
  const now=Date.now();

  const vesselRank=v=>{
    // In share mode treat fresh Supabase positions as live (ignore _historical flag)
    const isLive=!!v.lat&&!!v.ts&&(now-v.ts<600000)&&!v._vapi;
    const hasPos=!!v.lat&&!!v.ts;
    const carrying=!!isCarryingBooster(v.mmsi);
    if(carrying&&isLive) return 0;
    if(isLive) return 1;
    if(carrying) return 2;
    if(hasPos) return 3;
    return 4; // never seen
  };
  const acRank=reg=>{
    const ac=S.aircraft[reg];
    if(!ac) return 5;
    if(!ac._stale&&ac.alt!=='ground') return 0;
    if(!ac._stale&&(ac.gs||0)>3) return 1;
    if(!ac._stale) return 2;
    if(ac._staleTs&&now-ac._staleTs<3600000) return 3;
    return 4;
  };

  // All vessels — filter never-seen (no position ever) and share-mode stale
  const allVessels=KNOWN_MMSIS
    .map(mmsi=>S.vessels[mmsi]||{mmsi,...VESSEL_DB[mmsi],_offline:true})
    .filter(v=>{
      if(SHARE_MODE && v.ts && (now-v.ts >= STALE_14D)) return false;
      if(VESSEL_DB[v.mmsi]?.background && !v.lat) return false; // background: only show when spotted
      return true; // always show non-background vessels even if never seen
    })
    .sort((a,b)=>{ const ra=vesselRank(a),rb=vesselRank(b); return ra!==rb?ra-rb:(b.ts||0)-(a.ts||0); });

  // Aircraft — background only if spotted this session
  const allAC=Object.keys(AIRCRAFT_DB)
    .filter(reg=>!AIRCRAFT_DB[reg].background||!!S.aircraft[reg])
    .sort((a,b)=>{ const ra=acRank(a),rb=acRank(b); if(ra!==rb) return ra-rb;
      return (S.aircraft[b]?._staleTs||S.aircraft[b]?.ts||0)-(S.aircraft[a]?._staleTs||S.aircraft[a]?.ts||0); });

  // Spacecraft clusters — roster always shows all; map layer visibility controlled by toggle
  const scClusters=clusterSpacecraft();
  scClusters.sort((a,b)=>(a.longterm?1:0)-(b.longterm?1:0)||a.primary.localeCompare(b.primary));

  const scHTML=showSpacecraft?scClusters.map(buildSpacecraftRow).filter(Boolean).join(''):'';

  // Active = live vessels + airborne aircraft + orbiting spacecraft — all snap to top
  // Only genuinely underway vessels go to ACTIVE.
  // 1.5 kn threshold filters dock GPS drift (rarely exceeds 1 kn).
  // isNearPort guards against slow harbour maneuvering.
  const isVesselActive = v => {
    const age = v.ts ? now - v.ts : Infinity;
    const isLive = !!v.lat && !!v.ts && age < 600000 && !v._vapi;
    const moving = isLive && (v.sog || 0) > 0.5;
    const carrying = !!isCarryingBooster(v.mmsi);
    return moving || (carrying && isLive);
  };
  const isACairborne = r => acRank(r) === 0;
  const isOrbit      = c => S_spacecraft[c.primary]?.lat != null;

  const activeRows = [
    ...(showVessels    ? allVessels.filter(isVesselActive).map(buildVesselRow)               : []),
    ...(showAircraft   ? allAC.filter(isACairborne).map(buildAircraftRow)                    : []),
    ...(showSpacecraft ? scClusters.filter(isOrbit).map(buildSpacecraftRow).filter(Boolean)  : []),
  ].join('');

  const inactVesselHTML = showVessels    ? allVessels.filter(v=>!isVesselActive(v)).map(buildVesselRow).join('')   : '';
  const inactACHTML     = showAircraft   ? allAC.filter(r=>!isACairborne(r)).map(buildAircraftRow).join('')        : '';
  const inactSCHTML     = showSpacecraft ? scClusters.filter(c=>!isOrbit(c)).map(buildSpacecraftRow).filter(Boolean).join('') : '';

  const hdr = (label, mt=true) => `<div class="lhdr" style="font-size:10px;color:var(--t4)${mt?';margin-top:10px':''}">${label}</div>`;
  const parts = [];
  if (activeRows)     parts.push(`<div class="lhdr" style="font-size:10px;color:#00ff88;letter-spacing:.08em">● ACTIVE</div>${activeRows}`);
  if (inactVesselHTML) parts.push(hdr('VESSELS', parts.length>0) + inactVesselHTML);
  if (inactACHTML)     parts.push(hdr('AIRCRAFT', parts.length>0) + inactACHTML);
  if (inactSCHTML)     parts.push(hdr('SPACECRAFT', parts.length>0) + inactSCHTML);

  const facClusters = detectFacilityClusters();
  if (facClusters.length) {
    const facHTML = facClusters.map(f => {
      const names = [...f.vessels].slice(0, 3).join(', ') + (f.vessels.size > 3 ? ` +${f.vessels.size - 3}` : '');
      const knownPt = LANDMARKS.find(p => {
        const dLat = f.lat - p.lat, dLon = f.lon - p.lon;
        return Math.sqrt(dLat*dLat + dLon*dLon) * 111 < 10;
      });
      const label = knownPt ? knownPt.name : `${f.lat.toFixed(3)}°, ${f.lon.toFixed(3)}°`;
      return `<div class="vrow" onclick="map&&map.setView([${f.lat.toFixed(5)},${f.lon.toFixed(5)}],10)" style="cursor:pointer">
        <div class="vn" style="color:var(--t2);font-size:12px">${esc(label)}</div>
        <div class="vop" style="color:var(--t4)">${esc(names)}</div>
        <div class="vbottom">
          <div class="vdot" style="background:#ffcc00;box-shadow:0 0 4px #ffcc0066"></div>
          <span style="color:var(--t3);font-size:10px">${f.count} stop${f.count>1?'s':''} · ${f.vessels.size} vessel${f.vessels.size>1?'s':''}</span>
        </div>
      </div>`;
    }).join('');
    parts.push(hdr('DETECTED LOCATIONS', true) + facHTML);
  }

  document.getElementById('fleet').innerHTML = parts.join('');
  document.querySelectorAll('.vrow[data-mmsi]').forEach(el=>{el.onclick=()=>selectVessel(el.dataset.mmsi);});
  document.querySelectorAll('.vrow[data-reg]').forEach(el=>{el.onclick=()=>showAircraftDetail(el.dataset.reg);});
  document.querySelectorAll('.vrow[data-sc]').forEach(el=>{el.onclick=()=>showSpacecraftDetail(el.dataset.sc);});
}

function buildVesselRow(v){
  const sel=S.selected===v.mmsi, col=opColor(v.operator);
  const now2=Date.now(), age2=v.ts?now2-v.ts:Infinity;
  const isLive=!!v.lat&&!!v.ts&&age2<600000;
  const isRecent=!!v.lat&&!!v.ts&&age2<7200000; // <2h, not fully stale
  const isHist=v._historical&&!SHARE_MODE;
  const stale=!!v.lat&&!isRecent&&!isHist;
  const isOffline=v._offline||(!v.lat&&!isHist);
  const carrying=isCarryingBooster(v.mmsi);
  const stationary=isLive&&(v.sog==null||v.sog<=0.1);
  const moving=isLive&&!stationary;
  const recentMoving=!moving&&isRecent&&(v.sog!=null&&v.sog>0.5)&&!isNearPort(v.lat,v.lon);
  const recentStationary=!moving&&!stationary&&isRecent&&!recentMoving;
  const deployed=!isLive&&!isRecent&&deployedFleet.has(v.mmsi);
  const dotCol=moving?'#00ff88':stationary?'#338855':carrying?'#ff8c00':recentMoving?'#44cc77':recentStationary?'#226644':deployed?'#ff8c00':'#2a3a4a';
  const maneuvering=moving&&isNearPort(v.lat,v.lon);
  const status=maneuvering?'MANEUVERING':moving?'UNDERWAY':stationary?'DOCKED / STATIONARY':carrying&&!isLive?(carrying._transit?'BOOSTER EXPECTED':'NO AIS LOCK'):recentMoving?`UNDERWAY · LAST PING ${ageStr(v.ts)}`:recentStationary?`STATIONARY · ${ageStr(v.ts)}`:deployed?'DEPLOYED · OUT OF AIS RANGE':v.ts?`NO SIGNAL · ${ageStr(v.ts)}`:'NO SIGNAL';
  const nameCol=moving?col:stationary?col+'99':recentMoving?col:recentStationary?col+'88':v.ts?'var(--t3)':'var(--t4)';
  const roleCol=moving?col+'99':stationary?col+'55':recentMoving?col+'88':'var(--t4)';
  const bg=moving?(sel?'var(--bg4)':'rgba(0,200,255,.03)'):stationary?(sel?'var(--bg4)':''):recentMoving?(sel?'var(--bg4)':'rgba(0,200,100,.015)'):sel?'var(--bg4)':'';
  const borderCol=moving?col:stationary?col+'55':recentMoving?col+'88':'transparent';
  return `<div class="vrow${sel?' sel':''}" data-mmsi="${esc(v.mmsi)}"
    style="border-left-color:${borderCol}${bg?';background:'+bg:''}${moving?';box-shadow:inset 2px 0 8px '+col+'22':''}">
    <div class="vn" style="color:${nameCol};${moving?'text-shadow:0 0 12px '+col+'66':''}">${esc(v.abbr||v.name)}</div>
    <div class="vop" style="color:${roleCol}">${esc(v.operator)} · ${esc(v.role)}</div>
    ${carrying?`<div style="font-size:10px;font-weight:700;color:#ff8c00;letter-spacing:.04em;margin-top:2px">🚀 ${carrying._transit?'BOOSTER ABOARD · RETURNING TO PORT':'BOOSTER RECOVERY · '+esc(carrying.name||'')}</div>`:''}
    <div class="vbottom">
      <div class="vdot" style="background:${dotCol}${moving?';box-shadow:0 0 5px '+dotCol+'88':''}"></div>
      <span style="color:${dotCol};font-size:10px;font-weight:${isLive?'700':'400'}">${status}</span>
      ${v.sog!=null&&moving?`<span style="color:var(--t2);font-size:11px;margin-left:4px">${v.sog.toFixed(1)} kn</span>`:''}
      ${v.dest&&(isLive||isRecent)?`<span style="color:${isLive?'var(--t)':'var(--t5)'};font-size:10px;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px">→ ${esc(v.dest)}</span>`:''}
    </div>
  </div>`;
}

function buildAircraftRow(reg) {
  const db = AIRCRAFT_DB[reg];
  const ac = S.aircraft[reg];
  const col = opColor(db.operator);
  const hasLive = !!ac && !ac._stale;
  const airborne = hasLive && ac.alt !== 'ground';
  const taxiing  = hasLive && ac.alt === 'ground' && (ac.gs || 0) > 3;
  const recentLanded = ac?._stale && ac?.lat && ac?._staleTs && ac?.alt === 'ground' && (Date.now() - ac._staleTs < 3600000);
  const staleAirborne = ac?._stale && ac?.alt !== 'ground' && ac?.lat;
  const dotCol = airborne ? '#00ff88' : taxiing ? '#88dd44' : recentLanded ? '#ffcc00' : staleAirborne ? '#ffcc0044' : '#2a4a5a';
  const status = airborne ? 'AIRBORNE' : taxiing ? 'TAXIING' : recentLanded ? `LANDED ${ageStr(ac._staleTs)}` : staleAirborne ? `NO SIGNAL · ${ageStr(ac._staleTs)}` : 'ON GROUND';
  const alt = airborne && ac.alt != null ? ` · ${Math.round(ac.alt).toLocaleString()}ft` : '';
  const spd = (airborne || taxiing) && ac.gs != null ? ` · ${Math.round(ac.gs)}kn` : '';
  const active = airborne || taxiing;
  return `<div class="vrow" data-reg="${esc(reg)}" style="border-left-color:${active?col:recentLanded?col+'55':'transparent'}${active?';background:rgba(0,200,255,.03)':''}">
    <div class="vn" style="color:${active?col:recentLanded?'var(--t2)':'var(--t3)'}">${esc(db.abbr)}</div>
    <div class="vop" style="color:${active?col+'99':col+'33'}">${esc(db.operator)} · ${esc(db.model)}</div>
    <div class="vbottom">
      <div class="vdot" style="background:${dotCol}${active?';box-shadow:0 0 5px '+dotCol+'88':''}"></div>
      <span style="color:${dotCol};font-size:10px;font-weight:${active?'700':'400'}">${status}</span>
      ${active?`<span style="color:var(--t4);font-size:10px;margin-left:4px">${alt}${spd}</span>`:''}
    </div>
  </div>`;
}

// ── Right panel tabs ──────────────────────────────────────────
function setTab(t){
  S.tab=t;
  ['events','vessel','history','log','ops'].forEach(id=>{
    const b=document.getElementById('rtab-'+id); if(b) b.classList.toggle('act',id===t);
  });
  if(t==='log'){
    logUnread=0;
    const badge=document.getElementById('log-badge');
    if(badge) badge.style.display='none';
  }
  if(t==='ops') startOpsTicker();
  else { if(opsTicker){ clearInterval(opsTicker); opsTicker=null; } }
  renderRight();
}
function renderRight(){
  const el=document.getElementById('rpanel');
  if(S.tab==='events')     el.innerHTML=buildEventFeed();
  if(S.tab==='vessel')     { el.innerHTML=buildVesselDetail(); startCountdowns(); }
  if(S.tab==='aircraft')   el.innerHTML=buildAircraftDetail();
  if(S.tab==='spacecraft') el.innerHTML=buildSpacecraftDetail();
  if(S.tab==='history')    el.innerHTML=buildHistoryTab();
  if(S.tab==='log')        el.innerHTML=buildLogTab();
  if(S.tab==='ops')        el.innerHTML=buildOpsPanel(getActiveOpsLaunch());
}

function showAircraftDetail(reg) {
  S.selectedAircraft = reg;
  const ac = S.aircraft[reg];
  if(ac?.lat && ac?.lon && map) map.setView([ac.lat, ac.lon], 7);
  S.tab = 'aircraft';
  ['events','vessel','history','log'].forEach(id => {
    document.getElementById('rtab-'+id).classList.toggle('act', false);
  });
  document.getElementById('rtab-vessel').classList.add('act');
  renderRight();
}

function buildAircraftDetail() {
  const reg = S.selectedAircraft;
  if(!reg) return '<div style="padding:16px;color:var(--t4);font-size:12px">No aircraft selected.</div>';
  const db = AIRCRAFT_DB[reg];
  const ac = S.aircraft[reg];
  const col = opColor(db.operator);
  const hasLive = !!ac && !ac._stale;
  const airborne = hasLive && ac?.alt !== 'ground';
  const taxiing  = hasLive && ac?.alt === 'ground' && (ac?.gs || 0) > 3;
  const recentLanded = ac?._stale && ac?.lat && ac?._staleTs && ac?.alt === 'ground' && (Date.now() - ac._staleTs < 3600000);
  const alt = ac?.alt != null && ac.alt !== 'ground' ? Math.round(ac.alt).toLocaleString()+'ft' : '—';
  const spd = ac?.gs != null ? Math.round(ac.gs)+' kn' : '—';
  const hdg = ac?.track != null ? Math.round(ac.track)+'°' : '—';
  const pos = ac?.lat ? `${ac.lat.toFixed(4)}, ${ac.lon.toFixed(4)}` : 'No position';
  const lastFixTs = ac?._staleTs || ac?.ts;
  const staleAirborneD = ac?._stale && ac?.alt !== 'ground' && ac?.lat;
  const statusLabel = airborne ? 'AIRBORNE' : taxiing ? 'TAXIING' : recentLanded ? `LANDED ${ageStr(ac._staleTs)}` : staleAirborneD ? 'NO SIGNAL' : 'ON GROUND';
  const statusCol   = airborne ? '#00ff88' : taxiing ? '#88dd44' : recentLanded ? '#ffcc00' : staleAirborneD ? '#ffcc00' : 'var(--t4)';
  return `<div style="padding:14px 16px">
    ${db.photo?`<img src="${esc(db.photo)}" style="width:100%;max-height:160px;object-fit:cover;border-radius:3px;margin-bottom:10px;background:#0a1a2a" loading="lazy" onerror="this.style.display='none'">`:''}
    <div style="font-size:18px;font-weight:700;color:${col};letter-spacing:.04em;margin-bottom:2px">${esc(db.name)}</div>
    <div style="font-size:12px;color:var(--t4);margin-bottom:12px">${esc(db.operator)} · ${esc(db.model)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">
      ${stat('STATUS', statusLabel, statusCol)}
      ${stat('LAST FIX', lastFixTs ? ageStr(lastFixTs) : '—', 'var(--t2)')}
      ${stat('POSITION', pos, 'var(--t2)')}
      ${stat('ALTITUDE', alt, 'var(--t2)')}
      ${stat('SPEED', spd, 'var(--t2)')}
      ${stat('HEADING', hdg, 'var(--t2)')}
      ${stat('REG', reg, col)}
    </div>
    ${db.history?.length?`<div style="margin-bottom:10px">${db.history.map(h=>`<div style="font-size:11px;color:var(--t4);line-height:1.7;padding-left:8px;border-left:2px solid var(--bdr2)">· ${esc(h)}</div>`).join('')}</div>`:''}
    <div style="font-size:11px;color:var(--t5);line-height:1.6">${esc(db.notes||'')}</div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <a href="https://globe.adsbexchange.com/?icao=${esc(ac?.hex||'')}" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none${!ac?.hex?';opacity:.4;pointer-events:none':''}">ADSBEXCHANGE ↗</a>
      ${db.operator!=='SpaceX'?`
      <a href="https://www.flightaware.com/live/flight/${encodeURIComponent(reg.replace(/-/g,''))}" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none">FLIGHTAWARE ↗</a>
      <a href="https://www.flightradar24.com/data/aircraft/${encodeURIComponent(reg.toLowerCase())}" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none">FLIGHTRADAR24 ↗</a>`:''}
    </div>
  </div>`;
}
function stat(label,val,col){return`<div style="background:var(--bg3);padding:8px 10px;border-radius:2px"><div style="font-size:9px;color:var(--t4);letter-spacing:.08em;margin-bottom:2px">${label}</div><div style="font-size:12px;font-weight:600;color:${col}">${val}</div></div>`;}


// ── Event feed ────────────────────────────────────────────────
function buildBoosterCards() {
  const carrying = KNOWN_MMSIS
    .map(mmsi => ({ mmsi, mission: isCarryingBooster(mmsi) }))
    .filter(x => x.mission);
  if(!carrying.length) return '';
  return carrying.map(({mmsi, mission}) => {
    const db = VESSEL_DB[mmsi];
    const col = opColor(db?.operator);
    const net = mission.net ? new Date(mission.net).getTime() : null;
    return `<div class="erow" style="border-left-color:#ff8c00;background:rgba(255,140,0,.06);cursor:pointer" onclick="selectVessel('${mmsi}')">
      <div style="font-size:10px;font-weight:700;color:#ff8c00;letter-spacing:.08em;margin-bottom:4px">🚀 BOOSTER ABOARD</div>
      <div class="ename" style="color:${col}">${esc(db?.abbr||db?.name||mmsi)}</div>
      <div class="edetail">${esc(mission.name||'')} · launched ${net?ageStr(net):'—'}</div>
      <div style="font-size:11px;color:var(--t4);margin-top:3px">En route back to port</div>
    </div>`;
  }).join('');
}

function buildEventFeed(){
  const boosterCards = buildBoosterCards();
  if(!events.length) return boosterCards + (SHARE_MODE
    ? `<div class="empty">No events yet — position history loads on page open.</div>`
    : `<div class="empty">Connect AIS stream — events appear here in real time.<br><br>
    Detects: zone entries · underway/moored · AIS gaps · destination changes</div>`);
  return boosterCards + events.slice(0,200).map(buildEventRow).join('');
}
function buildEventRow(ev){
  const cfg=EV_CFG[ev.type]||{icon:'·',color:'#888'};
  return`<div class="erow" style="border-left-color:${esc(cfg.color)};cursor:pointer" onclick="selectVessel('${esc(ev.mmsi)}')">
    <div class="etime">${tsStr(ev.ts)}</div>
    <div style="display:flex;align-items:center;margin-bottom:2px">
      <span style="font-size:12px;margin-right:5px">${cfg.icon}</span>
      <span class="etype" style="color:${esc(cfg.color)}">${esc(ev.type)}</span>
      <span class="eop" style="color:${esc(ev.opColor)};border:1px solid ${esc(ev.opColor)}33">${esc(ev.operator)}</span>
    </div>
    <div class="ename" style="color:${esc(ev.opColor)};text-decoration:underline;text-underline-offset:2px">${esc(ev.name)}</div>
    <div class="edetail">${esc(ev.detail)}</div>
    ${ev.lat?`<div style="font-size:10px;color:var(--t4);margin-top:2px">${ev.lat.toFixed(3)}, ${ev.lon.toFixed(3)}</div>`:''}
  </div>`;
}
function prependEventRow(ev){
  const panel=document.getElementById('rpanel');
  if(S.tab!=='events'||!panel) return;
  const existing=panel.querySelectorAll('.erow');
  if(!existing.length){panel.innerHTML=buildEventRow(ev);return;}
  const tmp=document.createElement('div');
  tmp.innerHTML=buildEventRow(ev);
  panel.insertBefore(tmp.firstChild,panel.firstChild);
  while(panel.querySelectorAll('.erow').length>200) panel.removeChild(panel.lastChild);
}
function clearEvents(){events=[];saveLS();renderRight();}

// ── Vessel detail ─────────────────────────────────────────────
function buildVesselDetail(){
  const mmsi=S.selected;
  const db=VESSEL_DB[mmsi];
  if(!mmsi||!db) return`<div class="empty">← Select a vessel from the fleet list.</div>`;
  const live=S.vessels[mmsi];
  const v=live||{mmsi,...db,_offline:true};
  const col=opColor(db.operator), h=history[mmsi];

  const linkedMissions = l => {
    const op=Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'';
    return vesselHintsForLaunch(op, l.pad?.name||'', l.pad?.location?.name||'').includes(mmsi);
  };
  const upcomingMissions = missionsCache.filter(linkedMissions).slice(0,3);
  const recentMissions   = pastMissionsCache.filter(linkedMissions).slice(0,5);
  const carrying         = isCarryingBooster(mmsi);

  return`
    ${db.photo?`<img src="${esc(db.photo)}" style="width:100%;max-height:180px;object-fit:cover;background:#0a1a2a" loading="lazy" onerror="this.style.display='none'">`:''}
    <div class="dhdr" style="border-left:4px solid ${col}">
      <div class="dname" style="color:${col}">${esc(db.name)}</div>
      <div style="font-size:12px;color:var(--t5);margin-top:2px">${esc(db.operator)} · ${esc(db.role)}</div>
      ${db.homePort?`<div style="font-size:12px;color:var(--t4);margin-top:2px">📍 ${esc(db.homePort)}</div>`:''}
    </div>
    <div class="tbody">
      ${!SHARE_MODE&&!db.verified?`<div class="warn-box">⚠ MMSI ${esc(mmsi)} unverified — confirm at marinetraffic.com</div>`:''}
      ${!SHARE_MODE&&v._historical?`<div class="hist-box">📡 Showing last known position (${ageStr(v.ts)}). Connect AIS for live data.</div>`:''}
      ${!SHARE_MODE&&(!v.lat||v._offline)?`<div style="background:rgba(0,0,0,.15);border:1px solid var(--bdr);padding:8px 11px;font-size:12px;color:var(--t4);margin-bottom:6px">NO SIGNAL${v.ts?` · last seen ${ageStr(v.ts)}`:' · never tracked'}. Will appear on map when underway.</div>`:''}

      ${carrying?(()=>{
        const home = DRONE_HOME_PORTS[mmsi];
        const vp = S.vessels[mmsi];
        let distKm = null;
        if(home && vp?.lat) {
          const dLat=vp.lat-home.lat, dLon=(vp.lon-home.lon)*Math.cos(home.lat*Math.PI/180);
          distKm = Math.sqrt(dLat*dLat+dLon*dLon)*111;
        }
        const arriving = distKm != null && distKm < 200;
        const cams = PORT_WEBCAMS[mmsi] || [];
        const camHTML = cams.length ? `
          <div style="margin-top:8px;padding-top:7px;border-top:1px solid #ff8c0033">
            <div style="font-size:10px;color:#ff8c00;font-weight:700;letter-spacing:.06em;margin-bottom:5px">${arriving?'⚠ ARRIVING SOON · ':''}PORT WEBCAMS</div>
            ${cams.map(c=>`<a href="${esc(c.url)}" target="_blank" style="display:block;font-size:12px;color:#44aaff;text-decoration:none;margin-bottom:2px">↗ ${esc(c.label)}</a>${c.lookFor?`<div style="font-size:11px;color:var(--t4);margin-bottom:4px;font-style:italic">${esc(c.lookFor)}</div>`:''}`).join('')}
          </div>` : '';
        return `<div style="background:rgba(255,140,0,.1);border:1px solid #ff8c0066;padding:10px 13px;margin-bottom:6px">
          <div style="font-size:11px;font-weight:700;color:#ff8c00;letter-spacing:.06em;margin-bottom:3px">🚀 ${carrying._transit?'BOOSTER ABOARD · RETURNING TO PORT':'ACTIVE BOOSTER RECOVERY'}</div>
          <div style="font-size:13px;font-weight:600;color:var(--t2)">${esc(carrying.name||'')}</div>
          <div style="font-size:11px;color:var(--t4);margin-top:2px">${carrying._transit?`Landed ${ageStr(new Date(carrying.net).getTime())} ago · transit back to port`:`Launched ${ageStr(new Date(carrying.net).getTime())} · booster recovery in progress`}${distKm!=null?' · '+Math.round(distKm)+'km from port':''}</div>
          ${camHTML}
        </div>`;
      })():''}

      ${upcomingMissions.length?`
        <div class="sec">UPCOMING MISSIONS</div>
        ${upcomingMissions.map(l=>{
          const net=l.net?new Date(l.net).getTime():null;
          const col2=opColor(Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'');
          return`<div style="padding:8px 0;border-bottom:1px solid var(--bdr2)">
            <div style="font-size:13px;font-weight:600;color:${col2}">${esc(l.name||'')}</div>
            <div style="font-size:12px;color:var(--t5)">${esc(l.rocket?.configuration?.name||'')} · ${esc(l.pad?.location?.name||'')}</div>
            ${net?`<div style="font-family:var(--fm);font-size:13px;color:${col2};margin-top:3px" data-net="${net}">calculating…</div>`:''}
          </div>`;
        }).join('')}
      `:''}

      ${recentMissions.length?`
        <div class="sec">RECENT MISSIONS</div>
        ${recentMissions.map(l=>{
          const net=l.net?new Date(l.net).getTime():null;
          const col2=opColor(Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'');
          const status=l.status?.name||'';
          const statusCol=/Success/i.test(status)?'#00ff88':/Failure/i.test(status)?'#ff4444':'#ff8800';
          return`<div style="padding:8px 0;border-bottom:1px solid var(--bdr2)">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="font-size:13px;font-weight:600;color:${col2};flex:1">${esc(l.name||'')}</div>
              ${status?`<span style="font-size:10px;font-weight:700;color:${statusCol}">${esc(status.toUpperCase())}</span>`:''}
            </div>
            <div style="font-size:12px;color:var(--t5);margin-top:2px">${esc(l.rocket?.configuration?.name||'')} · ${net?fmtTime(net):'TBD'}</div>
          </div>`;
        }).join('')}
      `:''}

      <div class="sec">LIVE STATUS</div>
      ${frows([
        ['POSITION', v.lat?`${v.lat.toFixed(4)}°  ${v.lon.toFixed(4)}°`:'—'],
        ['SPEED',    v.sog!=null&&!v._historical&&!v._offline&&!v._vapi&&v.ts&&(Date.now()-v.ts<600000)?v.sog.toFixed(1)+' kn':'—'],
        ['COURSE',   v.cog!=null&&!v._historical&&!v._offline&&!v._vapi&&v.ts&&(Date.now()-v.ts<600000)?Math.round(v.cog)+'°':'—'],
        ['DESTINATION',v.dest||'—'],
        ['ETA',      v.eta||'—'],
        ['LAST FIX', v.ts?ageStr(v.ts):'never'],
      ])}

      <div class="sec">VESSEL IDENTITY</div>
      ${frows([
        ['MMSI',     mmsi],
        ['IMO',      db.imo||v.imo||'—'],
        ['CALLSIGN', v.cs||'—'],
        ['FLAG',     db.flag||'—'],
        ['BUILT',    db.built||'—'],
        ['AIS NAME', v.aisName||'—'],
      ])}

      ${db.specs?`<div class="sec">SPECIFICATIONS</div>
        ${frows(Object.entries(db.specs).map(([k,val])=>[k.toUpperCase(),val]))}`:''}

      ${h?`<div class="sec">TRACKED HISTORY</div>
        ${frows([
          ['FIRST SEEN', tsStr(h.firstSeen)],
          ['LAST SEEN',  tsStr(h.lastSeen)],
          ['POSITIONS',  h.positions.length+' recorded'+(SB.ready?' + Supabase':'')],
        ])}`:''}

      ${db.history?.length?`<div class="sec">BACKGROUND</div>
        <div class="abox">${db.history.map(l=>`• ${esc(l)}`).join('<br>')}</div>`:''}

      <div class="sec">LOOKUPS</div>
      ${[
        ['MarineTraffic', `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}/`],
        ['VesselFinder',  `https://www.vesselfinder.com/vessels/details/${mmsi}`],
        ['space-offshore.com','https://space-offshore.com'],
        ['Google News',   `https://news.google.com/search?q=${encodeURIComponent((db.abbr||db.name)+' vessel')}`],
      ].map(([l,u])=>`<a class="fr" href="${u}" target="_blank" rel="noopener" style="cursor:pointer;text-decoration:none">
        <span class="fk">${l}</span><span class="fv" style="color:#4488bb">↗</span></a>`).join('')}
    </div>`;
}

// ── History tab ───────────────────────────────────────────────
function buildHistoryTab(){
  const mmsi=S.selected;
  const evs=mmsi?events.filter(e=>e.mmsi===mmsi):events;
  const v=mmsi?S.vessels[mmsi]:null;
  const h=mmsi?history[mmsi]:null;
  return`<div class="tbody">
    ${v?`<div style="font-family:var(--fh);font-size:12px;color:${opColor(v.operator)};margin-bottom:8px">${esc(v.abbr||v.name)}</div>`:''}
    ${h?`<div style="font-size:11px;color:var(--t5);margin-bottom:10px">
      ${h.positions.length} positions · first seen ${tsStr(h.firstSeen)}${SB.ready?' · synced to Supabase':''}
    </div>`:''}
    <div class="sec">${mmsi?'VESSEL EVENT LOG':'ALL EVENTS — select vessel to filter'}</div>
    ${evs.length?evs.slice(0,500).map(e=>`
      <div class="fr">
        <span class="fk" style="color:${esc((EV_CFG[e.type]||{}).color||'#888')}">${esc(e.type)}</span>
        <span class="fv" style="font-size:10px;color:var(--t5)">${tsStr(e.ts)}</span>
      </div>
      <div style="font-size:11px;color:var(--t4);padding:2px 0 6px;border-bottom:1px solid var(--bdr2)">${esc(e.detail)}</div>`
    ).join(''):'<div style="color:var(--t4);font-size:12px;padding:12px 0">No events recorded yet.</div>'}
  </div>`;
}

function frows(arr){return arr.map(([k,v])=>`<div class="fr"><span class="fk">${k}</span><span class="fv">${esc(String(v))}</span></div>`).join('');}

// ── Timezone ──────────────────────────────────────────────────
const TZ_OPTIONS = [
  { label:'Local',                     value:'local' },
  { label:'UTC',                       value:'UTC' },
  { label:'Eastern (ET)',              value:'America/New_York' },
  { label:'Central (CT)',              value:'America/Chicago' },
  { label:'Mountain (MT)',             value:'America/Denver' },
  { label:'Pacific (PT)',              value:'America/Los_Angeles' },
  { label:'Hawaii (HT)',               value:'America/Honolulu' },
  { label:'London (GMT/BST)',          value:'Europe/London' },
  { label:'Paris / Berlin (CET/CEST)', value:'Europe/Paris' },
  { label:'Auckland (NZST)',           value:'Pacific/Auckland' },
];

let currentTZ = localStorage.getItem('space_intel_tz') || 'local';

function initTZSelect() {
  const sel = document.getElementById('tz-select');
  if(!sel) return;
  const localLabel = `Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
  TZ_OPTIONS[0].label = localLabel;
  sel.innerHTML = TZ_OPTIONS.map(o=>
    `<option value="${o.value}"${o.value===currentTZ?' selected':''}>${o.label}</option>`
  ).join('');
}

function setTZ(tz) {
  currentTZ = tz;
  localStorage.setItem('space_intel_tz', tz);
  if(document.getElementById('missions-panel').style.display!=='none') showMissions();
}

function fmtTime(ts) {
  if(!ts) return '—';
  const d = new Date(ts);
  const opts = { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short' };
  if(currentTZ==='local') return d.toLocaleString([], opts);
  return d.toLocaleString([], { ...opts, timeZone:currentTZ });
}

// Parse ISO 8601 duration e.g. "-PT38M" → -2280000 ms
function parseISODuration(s) {
  if (!s) return 0;
  const neg = s.startsWith('-');
  const m = s.replace(/^-/, '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!m) return 0;
  const ms = ((+m[1]||0)*86400 + (+m[2]||0)*3600 + (+m[3]||0)*60 + (+m[4]||0)) * 1000;
  return neg ? -ms : ms;
}
function formatDur(ms) {
  const abs = Math.abs(ms);
  const h = Math.floor(abs/3600000), mn = Math.floor((abs%3600000)/60000), s = Math.floor((abs%60000)/1000);
  return h ? `${h}:${String(mn).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${mn}:${String(s).padStart(2,'0')}`;
}

function formatTPlus(ms) {
  const sign = ms < 0 ? 'T−' : 'T+';
  const abs = Math.abs(ms);
  const h = Math.floor(abs/3600000), m = Math.floor((abs%3600000)/60000), s = Math.floor((abs%60000)/1000);
  return `${sign}${h ? String(h)+':' : ''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Version check — show refresh banner when new deploy detected ──
let _loadedVersion = null;
(function initVersionString() {
  const el = document.querySelector('#hdr .ht span');
  if (el) _loadedVersion = el.textContent.trim();
})();
async function checkForNewVersion() {
  if (!_loadedVersion) return;
  try {
    const r = await fetch(location.pathname || '/', { cache:'no-store' });
    const text = await r.text();
    const m = text.match(/v\d+\.\d+\.\d+/);
    if (m && m[0] !== _loadedVersion) {
      const b = document.getElementById('stale-banner');
      if (b) b.style.display = '';
    }
  } catch(e) {}
}
setInterval(checkForNewVersion, 5 * 60000);

// ── Mission Ops ───────────────────────────────────────────────
let opsTicker = null;
let _opsAutoId  = null;

function getActiveOpsLaunch() {
  const now = Date.now();
  return [...missionsCache, ...pastMissionsCache].find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if (!net) return false;
    const el = now - net;
    return el > -30*60000 && el < 3*3600000;
  });
}

function getOpsTimeline(launch) {
  const apiTL = (launch.timeline || []);
  if (apiTL.length > 2) {
    return apiTL
      .map(e => ({ t: parseISODuration(e.relative_time)/1000, label: e.type?.name || e.description || '', vessel: null, highlight: false }))
      .sort((a,b) => a.t - b.t);
  }
  const vehicle = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '';
  return timelineForVehicle(vehicle) || [];
}

function buildOpsPanel(launch) {
  if (!launch) return '<div class="empty">No active mission.</div>';
  const net = launch.net ? new Date(launch.net).getTime() : null;
  if (!net) return '<div class="empty">Launch time TBD.</div>';
  const now = Date.now(), elapsed = now - net;
  const lsp  = launch.launch_service_provider?.name || '';
  const vehicle = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '';
  const op  = Object.entries(OPERATOR_MATCH).find(([k]) => lsp.includes(k))?.[1] || lsp;
  const col = opColor(op);
  const patch   = launch.mission_patches?.[0]?.image_url || launch.image || null;
  const watchLinks = getLaunchWatchLinks(op);
  const pad = launch.pad?.name || launch.launch_service_provider?.name || '';

  const events = getOpsTimeline(launch);
  const pastEvt = events.filter(e => e.t*1000 <= elapsed);
  const nextEvt = events.find(e => e.t*1000 > elapsed);
  const curEvt  = pastEvt[pastEvt.length - 1];
  const phase   = curEvt?.label || (elapsed < 0 ? 'Pre-launch countdown' : 'In flight');

  const tlHTML = events.map(e => {
    const eMs = e.t * 1000;
    const isPast = eMs <= elapsed;
    const isCur  = isPast && e === curEvt;
    const tStr   = e.t < 0 ? `T−${formatDur(-eMs)}` : e.t === 0 ? 'T+0:00' : `T+${formatDur(eMs)}`;
    const ttg    = !isPast ? `<span style="color:var(--t5);font-size:10px"> in ${formatDur(eMs-elapsed)}</span>` : '';
    const vLink  = e.vessel && VESSEL_DB[e.vessel]
      ? ` <span onclick="selectVesselFromOps('${e.vessel}')" style="cursor:pointer;color:${opColor(VESSEL_DB[e.vessel].operator)};font-size:10px">→ ${VESSEL_DB[e.vessel].abbr}</span>` : '';
    return `<div class="ops-event${isPast&&!isCur?' past':''}${isCur?' current':''}">
      <span class="ops-et" style="font-family:var(--fm);font-size:11px;color:${isPast?'var(--t5)':'var(--t3)'};min-width:68px;flex-shrink:0">${tStr}</span>
      <span class="ops-el" style="font-size:12px;color:${isPast?'var(--t5)':'var(--t2)'};flex:1">${esc(e.label)}${vLink}${ttg}</span>
      ${isPast ? '<span style="color:#336633;font-size:11px">✓</span>' : ''}
    </div>`;
  }).join('');

  return `<div style="display:flex;flex-direction:column;height:100%">
    <div style="background:linear-gradient(180deg,${col}1a 0%,transparent 90px);border-bottom:2px solid ${col}44;padding:14px 18px 12px;flex-shrink:0">
      <div style="display:flex;align-items:flex-start;gap:10px">
        ${patch?`<img src="${esc(patch)}" style="width:42px;height:42px;object-fit:contain;border-radius:3px;background:#0a1a2a;padding:2px;flex-shrink:0">` : ''}
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:${col};text-transform:uppercase;letter-spacing:.07em;font-weight:600">${esc(op)} · ${esc(vehicle)}</div>
          <div style="font-size:13px;font-weight:600;color:#fff;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(launch.name||'')}">${esc(launch.name||'Unknown Mission')}</div>
          <div style="font-size:10px;color:var(--t4);margin-bottom:3px">${elapsed<0?'COUNTDOWN':'MISSION ELAPSED TIME'}</div>
          <div id="ops-tplus" class="ops-tplus" style="color:${elapsed<0?'#ff9900':'#fff'}">${formatTPlus(elapsed)}</div>
        </div>
      </div>
      <div style="margin-top:8px;padding-top:7px;border-top:1px solid ${col}33;display:flex;align-items:center;gap:7px">
        <span style="width:7px;height:7px;border-radius:50%;background:${col};flex-shrink:0;animation:pulse 1.2s ease infinite"></span>
        <span style="font-size:12px;color:var(--t2);flex:1">${esc(phase)}</span>
        ${nextEvt?`<span id="ops-next" style="font-size:10px;color:var(--t4)">Next: ${formatDur(nextEvt.t*1000-elapsed)}</span>`:''}
      </div>
    </div>
    <div style="padding:4px 18px 8px;overflow-y:auto;flex:1">
      <div style="font-size:10px;color:var(--t4);letter-spacing:.07em;text-transform:uppercase;margin:10px 0 6px">TIMELINE</div>
      ${tlHTML||'<div style="color:var(--t5);font-size:12px;padding:8px 0">No timeline data for this vehicle.</div>'}
    </div>
    ${watchLinks.length?`<div style="padding:10px 18px;border-top:1px solid var(--bdr2);flex-shrink:0;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <span style="font-size:10px;color:var(--t4);letter-spacing:.06em;margin-right:2px">WATCH</span>
      ${watchLinks.map(w=>`<a href="${esc(w.url)}" target="_blank" style="font-size:11px;font-weight:600;padding:4px 10px;background:${col}22;border:1px solid ${col}44;color:${col};text-decoration:none;border-radius:2px;white-space:nowrap">▶ ${esc(w.label)}</a>`).join('')}
    </div>`:''}
  </div>`;
}

function startOpsTicker() {
  if (opsTicker) clearInterval(opsTicker);
  opsTicker = setInterval(() => {
    const launch = getActiveOpsLaunch();
    if (!launch || S.tab !== 'ops') { clearInterval(opsTicker); opsTicker = null; return; }
    const net = new Date(launch.net).getTime();
    const elapsed = Date.now() - net;
    const tEl = document.getElementById('ops-tplus');
    if (tEl) { tEl.textContent = formatTPlus(elapsed); tEl.style.color = elapsed < 0 ? '#ff9900' : '#fff'; }
    const nEl = document.getElementById('ops-next');
    const events = getOpsTimeline(launch);
    const nextEvt = events.find(e => e.t * 1000 > elapsed);
    if (nEl && nextEvt) nEl.textContent = `Next: ${formatDur(nextEvt.t*1000 - elapsed)}`;
    // Re-render if phase crossed
    const curEvt = events.filter(e => e.t*1000 <= elapsed).slice(-1)[0];
    if (curEvt?.label !== S._opsPhase) { S._opsPhase = curEvt?.label; renderRight(); }
  }, 1000);
}

function selectVesselFromOps(mmsi) {
  S.selected = mmsi;
  if (S.vessels[mmsi]?.lat && map) map.setView([S.vessels[mmsi].lat, S.vessels[mmsi].lon], 7);
  setTab('vessel');
}

// ── Missions (The Space Devs API) ─────────────────────────────
let countdownTimer = null;
function startCountdowns() {
  if(countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(()=>{
    document.querySelectorAll('[data-net]').forEach(el=>{
      const net = parseInt(el.dataset.net);
      if(!net) return;
      const diff = net - Date.now();
      const abs  = Math.abs(diff);
      const d=Math.floor(abs/86400000), h=Math.floor((abs%86400000)/3600000),
            m=Math.floor((abs%3600000)/60000),  s=Math.floor((abs%60000)/1000);
      const parts = `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
      el.textContent = diff > 0 ? `T-${parts}` : `T+${parts}`;
    });
  }, 1000);
}

function updateDeployedFleet() {
  deployedFleet.clear();
  const now = Date.now();
  const WINDOW_BEFORE = 48 * 3600000; // vessels deploy up to 48h before launch
  const WINDOW_AFTER  =  8 * 3600000; // keep flagged 8h after NET (covers landing + return transit start)
  for (const launch of missionsCache) {
    const net = launch.net ? new Date(launch.net).getTime() : null;
    if (!net || net < now - WINDOW_AFTER || net > now + WINDOW_BEFORE) continue;
    const op      = Object.entries(OPERATOR_MATCH).find(([k]) => (launch.launch_service_provider?.name||'').includes(k))?.[1] || '';
    const padName = (launch.pad?.name || '') + ' ' + (launch.pad?.location?.name || '');
    // Primary droneship/recovery vessels from hints
    vesselHintsForLaunch(op, padName).forEach(mmsi => deployedFleet.add(mmsi));
    // Add support vessels by pad
    if (/Vandenberg|SLC-4/i.test(padName)) {
      deployedFleet.add('368237190'); // GO Beyond
      deployedFleet.add('366888850'); // Lindsay C
    }
  }
}

async function fetchMissionsBackground() {
  try {
    const cachedUp   = JSON.parse(localStorage.getItem(LS.MISSIONS)     ||'null');
    const cachedPast = JSON.parse(localStorage.getItem(LS.MISSIONS_PAST)||'null');
    const rateUntil = parseInt(localStorage.getItem('space_intel_429_until')||'0');
    const blocked = rateUntil > Date.now();
    const upFresh   = blocked || (cachedUp?.ts   && Date.now() - cachedUp.ts   < 1800000);
    const pastFresh = blocked || (cachedPast?.ts && Date.now() - cachedPast.ts < 1800000);

    if(upFresh && pastFresh) {
      if(!missionsCache.length     && cachedUp.data)   missionsCache     = cachedUp.data;
      if(!pastMissionsCache.length && cachedPast.data) pastMissionsCache = cachedPast.data;
      updateDeployedFleet();
      addLog(`Missions: cache fresh — skipping fetch`, 'sys');
      if(S.tab==='vessel') renderRight();
      return;
    }

    const base = 'https://ll.thespacedevs.com/2.3.0/launches/';
    const opFilter = l => Object.keys(OPERATOR_MATCH).some(k=>(l.launch_service_provider?.name||'').includes(k));

    const fetches = [];
    if(!upFresh)   fetches.push(fetch(`${base}upcoming/?limit=30&ordering=net&mode=detailed`));
    if(!pastFresh) fetches.push(fetch(`${base}previous/?limit=20&ordering=-net&mode=detailed`));
    const results = await Promise.all(fetches);

    let i = 0;
    if(!upFresh) {
      const r = results[i++];
      if(r.ok) {
        const d = await r.json();
        missionsCache = (d.results||[]).filter(l => {
          const netTs = l.net ? new Date(l.net).getTime() : null;
          if(netTs && Date.now() - netTs > 3600000) return false;
          return opFilter(l);
        });
        saveMissions();
      }
    }
    if(!pastFresh) {
      const r = results[i++];
      if(r.ok) {
        const d = await r.json();
        pastMissionsCache = (d.results||[]).filter(opFilter);
        savePastMissions();
      }
    }

    addLog(`Missions: ${missionsCache.length} upcoming · ${pastMissionsCache.length} recent`, 'sys');
    if(S.tab==='vessel') renderRight();
  } catch(e) {
    addLog(`Missions background fetch failed: ${e.message}`, 'err');
  }
}

async function showMissions() {
  const panel = document.getElementById('missions-panel');
  panel.style.display = 'block';

  // Serve from cache if < 30 minutes old — avoids burning rate limit on every open
  const cachedMeta = (() => { try { return JSON.parse(localStorage.getItem(LS.MISSIONS)||'null'); } catch(e){return null;} })();
  const _rateUntil = parseInt(localStorage.getItem('space_intel_429_until')||'0');
  if((cachedMeta?.ts && Date.now() - cachedMeta.ts < 1800000 && missionsCache.length) || (_rateUntil > Date.now() && missionsCache.length)) {
    const ageMin = Math.round((Date.now() - cachedMeta.ts) / 60000);
    document.getElementById('missions-src').textContent =
      `${missionsCache.length} upcoming · cached ${ageMin}m ago · The Space Devs API`;
    document.getElementById('missions-content').innerHTML =
      `<div style="padding:10px 18px 6px;font-size:11px;font-weight:700;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--bdr2)">UPCOMING</div>` +
      missionsCache.map(buildMissionCard).join('');
    startCountdowns();
    addLog(`Missions: served from cache (${ageMin}m old)`, 'sys');
    return;
  }

  document.getElementById('missions-content').innerHTML =
    '<div style="padding:24px;color:var(--t4)">Loading…</div>';
  addLog('Missions: fetching from The Space Devs API…', 'sys');
  try {
    const base = 'https://ll.thespacedevs.com/2.3.0/launches/';
    const [upResp, pastResp] = await Promise.all([
      fetch(`${base}upcoming/?limit=30&ordering=net&mode=detailed`),
      fetch(`${base}previous/?limit=20&ordering=-net&mode=detailed`),
    ]);
    if(!upResp.ok) throw new Error(`HTTP ${upResp.status}`);
    const upData   = await upResp.json();
    const pastData = pastResp.ok ? await pastResp.json() : { results:[] };

    const filterFn = l => {
      const lsp = l.launch_service_provider?.name||'';
      const netTs = l.net ? new Date(l.net).getTime() : null;
      if(netTs && Date.now() - netTs > 3600000) return false;
      return Object.keys(OPERATOR_MATCH).some(k=>lsp.includes(k));
    };
    const upcoming = (upData.results||[]).filter(filterFn);
    const past     = (pastData.results||[]).filter(filterFn);

    missionsCache     = upcoming;
    pastMissionsCache = past;
    saveMissions();
    savePastMissions();
    updateDeployedFleet();

    addLog(`Missions: ${upcoming.length} upcoming, ${past.length} recent past`, 'sys');
    document.getElementById('missions-src').textContent =
      `${upcoming.length} upcoming · ${past.length} recent · The Space Devs API · ${new Date().toLocaleTimeString()}`;

    let html = '';
    if(upcoming.length) {
      html += `<div style="padding:10px 18px 6px;font-size:11px;font-weight:700;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--bdr2)">UPCOMING</div>`;
      html += upcoming.map(buildMissionCard).join('');
    }
    if(past.length) {
      html += `<div style="padding:10px 18px 6px;font-size:11px;font-weight:700;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--bdr2);margin-top:8px">RECENT — ACTUAL TIMES</div>`;
      html += past.map(l=>buildMissionCard(l, true)).join('');
    }
    document.getElementById('missions-content').innerHTML = html ||
      '<div style="padding:20px;color:var(--t4)">No missions found.</div>';
    startCountdowns();
  } catch(e) {
    addLog(`Missions fetch error: ${e.message}`, 'err');
    if(missionsCache.length) {
      const is429 = e.message.includes('429');
      if (is429) localStorage.setItem('space_intel_429_until', String(Date.now() + 1800000));
      document.getElementById('missions-src').textContent =
        `${is429?'Rate limited':'Error'} — showing cached data · The Space Devs API`;
      document.getElementById('missions-content').innerHTML =
        `<div style="background:rgba(255,140,0,.07);border-bottom:1px solid #553300;padding:9px 18px;font-size:12px;color:#cc7700">
          ⚠ ${is429?'API rate limited (429) — showing cached data, retry in 30 min':'Could not reach API'} · displaying cached missions
        </div>` +
        `<div style="padding:10px 18px 6px;font-size:11px;font-weight:700;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--bdr2)">UPCOMING</div>` +
        missionsCache.map(buildMissionCard).join('');
      startCountdowns();
    } else {
      document.getElementById('missions-src').textContent = 'Could not load — check connection';
      document.getElementById('missions-content').innerHTML =
        `<div style="padding:20px;color:var(--t4)">Could not reach The Space Devs API: ${esc(e.message)}</div>`;
    }
  }
}

// Curated "where to watch" links per operator — independent of Space Devs vid_urls.
// /live suffix on YouTube channels opens live stream if active, else most recent video.
const LAUNCH_WATCH_LINKS = {
  'SpaceX': [
    { label:'SpaceX',          url:'https://x.com/spacex' },
    { label:'NSF',             url:'https://www.youtube.com/@NASASpaceflight/live' },
    { label:'Spaceflight Now', url:'https://www.youtube.com/@SpaceflightNow/live' },
  ],
  'Blue Origin': [
    { label:'Blue Origin',     url:'https://www.youtube.com/@BlueOrigin/live' },
    { label:'NSF',             url:'https://www.youtube.com/@NASASpaceflight/live' },
  ],
  'Rocket Lab': [
    { label:'Rocket Lab',      url:'https://www.youtube.com/@RocketLab/live' },
    { label:'NSF',             url:'https://www.youtube.com/@NASASpaceflight/live' },
    { label:'Spaceflight Now', url:'https://www.youtube.com/@SpaceflightNow/live' },
  ],
  'ULA': [
    { label:'ULA',             url:'https://www.youtube.com/@ulalaunch/live' },
    { label:'NSF',             url:'https://www.youtube.com/@NASASpaceflight/live' },
    { label:'Spaceflight Now', url:'https://www.youtube.com/@SpaceflightNow/live' },
  ],
  'NASA': [
    { label:'NASA',            url:'https://www.youtube.com/nasalive' },
    { label:'NSF',             url:'https://www.youtube.com/@NASASpaceflight/live' },
  ],
};
function getLaunchWatchLinks(op) { return LAUNCH_WATCH_LINKS[op] || []; }

function buildMissionCard(l, isPast=false) {
  if (l.id) _missionById[l.id] = l;
  const lsp       = l.launch_service_provider?.name||'';
  const op        = Object.entries(OPERATOR_MATCH).find(([k])=>lsp.includes(k))?.[1]||lsp;
  const col       = opColor(op);
  const net       = l.net ? new Date(l.net).getTime() : null;
  const netStr    = net ? fmtTime(net) : 'TBD';
  const pad       = l.pad?.name||'';
  const loc       = l.pad?.location?.name||'';
  const status    = l.status?.name||'';
  const statusCol = /Go|Success/i.test(status)?'#00ff88':/Hold|Delay/i.test(status)?'#ff4444':'#ff8800';
  const vehicle   = l.rocket?.configuration?.name||'';
  const missionType = l.mission?.type||'';
  const desc      = l.mission?.description||'';
  const orbit     = l.mission?.orbit?.name||'';
  const prob      = l.probability != null ? l.probability : null;
  const winStart  = l.window_start ? new Date(l.window_start).getTime() : null;
  const winEnd    = l.window_end   ? new Date(l.window_end).getTime()   : null;
  const uncertain = !l.net || /TBD|NET|No Earlier/i.test(l.net_precision?.name||'');
  const vessels   = vesselHintsForLaunch(op, pad, loc);
  const timeline  = timelineForVehicle(vehicle);

  // Space Devs extras
  const patch    = l.mission_patches?.[0]?.image_url || null;
  const watchLinks = getLaunchWatchLinks(op);
  const crew     = l.launch_crew || [];
  const programs = l.program || [];
  const apiTL    = (l.timeline||[]).sort((a,b)=>parseISODuration(a.relative_time)-parseISODuration(b.relative_time));

  // Press kit lookup
  const missionLinks = Object.entries(MISSION_LINKS).find(([k])=>(l.name||'').includes(k))?.[1] || null;

  // Vessel timeline — patch drone ship to pad-aware MMSI
  const isLandingPlatform = m => { const r=(VESSEL_DB[m]?.role||'').toLowerCase(); return r.includes('drone')||r.includes('landing platform'); };
  const droneMMSI    = vessels.find(isLandingPlatform);
  const apiDroneMMSI = (timeline||[]).find(e=>e.highlight&&e.vessel&&isLandingPlatform(e.vessel))?.vessel;
  const hasMismatch  = apiDroneMMSI && droneMMSI && apiDroneMMSI !== droneMMSI;
  const patchedTL    = timeline ? timeline.map(e =>
    (e.vessel && isLandingPlatform(e.vessel) && droneMMSI && e.vessel!==droneMMSI)
      ? {...e, vessel:droneMMSI} : e) : null;
  const catchEvents  = (patchedTL||[]).filter(e=>e.highlight&&e.vessel&&VESSEL_DB[e.vessel]);
  const catchVessel  = catchEvents[0]?.vessel;
  const catchV       = catchVessel ? VESSEL_DB[catchVessel] : null;

  // ── HTML sections ─────────────────────────────────────────────
  const headerHTML = `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:8px">
      ${patch?`<img src="${esc(patch)}" style="width:54px;height:54px;object-fit:contain;flex-shrink:0;border-radius:4px;background:#0a1a2a;padding:2px" loading="lazy">` : ''}
      <div style="flex:1;min-width:0">
        <div class="mcard-name" style="color:${col}">${esc(l.name||'Unknown Mission')}</div>
        <div class="mcard-sub">${esc(vehicle)}${vehicle&&(loc||pad)?' · ':''}${esc(loc||pad)}</div>
        <div class="mcard-meta" style="margin-top:5px">
          <span class="mtag" style="background:${col}22;color:${col}">${esc(op)}</span>
          ${missionType?`<span class="mtag" style="background:#1a2a3a;color:var(--t5)">${esc(missionType)}</span>`:''}
          ${orbit?`<span class="mtag" style="background:#1a2a3a;color:var(--t5)">${esc(orbit)}</span>`:''}
          <span class="mtag" style="background:${statusCol}22;color:${statusCol}">${esc(status)}</span>
          ${prob!=null?`<span class="mtag" style="background:#1a3a2a;color:#44dd88">${prob}% go</span>`:''}
        </div>
      </div>
    </div>`;

  const countdownHTML = `
    <div class="mcountdown" style="color:${isPast?'var(--t5)':col}" ${net?`data-net="${net}"`:''}>${net?'calculating…':'Date TBD'}</div>
    <div class="mcountdown-lbl">${esc(netStr)}${isPast?` · <span style="color:${/Success/i.test(status)?'#00ff88':'#ff4444'};font-weight:700">${esc(status)}</span>`:''}
      ${winStart&&winEnd&&!isPast?`<span style="color:var(--t5);font-size:10px"> · window ${fmtTime(winStart)}–${fmtTime(winEnd)}</span>`:''}
    </div>`;

  const programsHTML = programs.length ? `
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin:8px 0 4px">
      ${programs.map(p=>{
        const link = typeof PROGRAM_LINKS !== 'undefined' && PROGRAM_LINKS[p.name];
        const chip = `<span style="font-size:10px;padding:2px 8px;background:#1a2535;border:1px solid #2a3a50;color:var(--t3);border-radius:10px;white-space:nowrap">${esc(p.name)}</span>`;
        return link?`<a href="${esc(link)}" target="_blank" style="text-decoration:none">${chip}</a>`:chip;
      }).join('')}
    </div>` : '';

  const linksHTML = (watchLinks.length||missionLinks||l.url||l.flightclub_url) ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 6px;align-items:center">
      ${watchLinks.length?`<span style="font-size:10px;color:var(--t4);letter-spacing:.06em">WATCH</span>${watchLinks.map(w=>`<a href="${esc(w.url)}" target="_blank" style="font-size:11px;font-weight:600;padding:5px 10px;background:${col}25;border:1px solid ${col}55;color:${col};text-decoration:none;border-radius:2px;white-space:nowrap">▶ ${esc(w.label)}</a>`).join('')}`:''}
      ${missionLinks?.pressKit?`<a href="${esc(missionLinks.pressKit)}" target="_blank"
        style="font-size:11px;padding:5px 11px;background:#1a2a1a;border:1px solid #335533;color:#77bb77;text-decoration:none;border-radius:2px;white-space:nowrap">📄 PRESS KIT</a>`:''}
      ${missionLinks?.page?`<a href="${esc(missionLinks.page)}" target="_blank"
        style="font-size:11px;padding:5px 11px;background:#1a2030;border:1px solid #2a3a50;color:var(--t3);text-decoration:none;border-radius:2px;white-space:nowrap">NASA ↗</a>`:''}
      ${l.flightclub_url?`<a href="${esc(l.flightclub_url)}" target="_blank"
        style="font-size:11px;padding:5px 11px;background:#1a2030;border:1px solid #2a3a50;color:var(--t4);text-decoration:none;border-radius:2px;white-space:nowrap">FlightClub ↗</a>`:''}
    </div>` : '';

  const descHTML = desc ? `<div class="mcard-desc" style="-webkit-line-clamp:unset;max-height:none">${esc(desc)}</div>` : '';

  const crewHTML = crew.length ? `
    <div style="margin:12px 0 4px">
      <div style="font-size:11px;font-weight:600;color:var(--t4);letter-spacing:.06em;margin-bottom:8px">CREW (${crew.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${crew.map(c=>{
          const a = c.astronaut||{};
          const img = a.profile_image_thumbnail||a.profile_image;
          const agencyUrl = a.agency?.country_code==='USA'?'https://www.nasa.gov/':null;
          return `<div style="display:flex;align-items:center;gap:7px;background:#111f2e;border:1px solid #1e3040;padding:7px 9px;border-radius:3px;flex:1;min-width:150px">
            ${img?`<img src="${esc(img)}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid #2a4a6a" loading="lazy">`:
                  `<div style="width:34px;height:34px;border-radius:50%;background:#1a3a5a;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#4488aa;font-size:15px">◈</div>`}
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--t)">${esc(a.name||'—')}</div>
              <div style="font-size:10px;color:var(--t4);margin-top:1px">${esc(c.role||'')}${a.agency?.abbrev?' · <b style="color:var(--t3)">'+esc(a.agency.abbrev)+'</b>':''}</div>
              ${a.nationality?`<div style="font-size:10px;color:var(--t5)">${esc(a.nationality)}</div>`:''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const catchHTML = catchV ? `
    <div class="vessel-link" onclick="openVesselFromMission('${catchVessel}')"
      style="margin-top:10px;padding:10px 12px;background:${opColor(catchV.operator)}11;border:1px solid ${opColor(catchV.operator)}44;border-radius:2px;cursor:pointer">
      <div style="font-size:11px;font-weight:600;color:var(--t4);letter-spacing:.06em;margin-bottom:4px">PROJECTED CATCH VESSEL ↗</div>
      <div style="font-size:15px;font-weight:700;color:${opColor(catchV.operator)}">${esc(catchV.name||catchV.abbr)}</div>
      <div style="font-size:12px;color:var(--t5);margin-top:2px">${esc(catchV.role)} · ${esc(catchV.homePort||'')}</div>
      <div style="font-size:12px;color:var(--t4);margin-top:3px">${esc(catchEvents[0].label)}</div>
    </div>` : '';

  const vesselTLHTML = patchedTL ? `
    <div style="margin:12px 0 4px">
      <div style="font-size:11px;font-weight:600;color:var(--t4);letter-spacing:.06em;margin-bottom:8px">${isPast?'TIMELINE (projected vessel times)':'PROJECTED TIMELINE'}</div>
      ${patchedTL.map(e=>{
        const tv = e.vessel&&VESSEL_DB[e.vessel];
        const absTime = (net&&e.t>60) ? fmtTime(net+e.t*1000) : null;
        return `<div style="display:flex;align-items:baseline;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr2)${e.highlight?';background:'+col+'08':''};border-radius:2px">
          <span style="font-family:var(--fm);font-size:12px;color:${e.highlight?col:'var(--t4)'};flex:1">${esc(e.label)}</span>
          ${absTime?`<span style="font-size:10px;color:var(--t5);flex-shrink:0">${esc(absTime)}</span>`:''}
          ${tv?`<span class="vessel-link" onclick="openVesselFromMission('${e.vessel}')" style="font-size:11px;color:${opColor(tv.operator)};flex-shrink:0;margin-left:${absTime?'0':'auto'};cursor:pointer;text-decoration:underline;text-underline-offset:2px">${esc(tv.abbr||tv.name)} ↗</span>`:''}
        </div>`;
      }).join('')}
    </div>` : '';

  const withinWindow = net && Math.abs(net-Date.now()) < 48*3600000;
  const apiTLHTML = apiTL.length ? `
    <details style="margin:10px 0" ${withinWindow?'open':''}>
      <summary style="font-size:11px;font-weight:600;color:var(--t4);letter-spacing:.06em;cursor:pointer;user-select:none;list-style:none;display:flex;justify-content:space-between">
        <span>COUNTDOWN EVENTS</span><span style="color:var(--t5)">${apiTL.length} events ▾</span>
      </summary>
      <div style="margin-top:6px;max-height:200px;overflow-y:auto">
        ${apiTL.map(e=>{
          const ms = parseISODuration(e.relative_time);
          const tStr = ms<0?`T-${formatDur(-ms)}`:ms===0?'T+0':`T+${formatDur(ms)}`;
          const absT = net ? fmtTime(net+ms) : null;
          return `<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--bdr2)">
            <span style="font-family:var(--fm);font-size:11px;color:var(--acc);flex-shrink:0;min-width:64px">${esc(tStr)}</span>
            <span style="font-size:11px;color:var(--t3);flex:1">${esc(e.type?.abbrev||e.type?.description||'')}</span>
            ${absT?`<span style="font-size:10px;color:var(--t5);flex-shrink:0">${esc(absT)}</span>`:''}
          </div>`;
        }).join('')}
      </div>
    </details>` : '';

  const vesselListHTML = vessels.length&&!catchV ? `
    <div class="mcard-vessels">
      <div style="font-size:11px;color:var(--t4);font-weight:600;letter-spacing:.06em;margin-bottom:6px">VESSELS DEPLOYED</div>
      ${vessels.map(m=>{const v=VESSEL_DB[m];return`<div class="vessel-link" onclick="openVesselFromMission('${m}')" style="font-size:13px;color:${opColor(v.operator)};padding:3px 0;cursor:pointer">
        ${esc(v.abbr||v.name)} <span style="color:var(--t5);font-size:11px">· ${esc(v.role)}</span> <span style="font-size:11px">↗</span>
      </div>`;}).join('')}
    </div>` : '';

  const hasTraj = lsp.includes('SpaceX')||lsp.includes('Blue Origin')||lsp.includes('Rocket Lab');
  const arcBtnHTML = hasTraj && l.id ? `
    <div style="margin:8px 0 4px">
      <button onclick="showMissionArc('${l.id.replace(/'/g,"\\'")}');return false"
        style="font-size:11px;font-weight:700;padding:5px 13px;background:#0a1e30;border:1px solid #1a4060;color:#44aaff;cursor:pointer;letter-spacing:.04em;border-radius:2px">
        TRAJECTORY ↗
      </button>
    </div>` : '';

  return `<div class="mcard" style="border-left-color:${col}">
    ${headerHTML}
    ${countdownHTML}
    ${programsHTML}
    ${linksHTML}
    ${arcBtnHTML}
    ${descHTML}
    ${crewHTML}
    ${catchHTML}
    ${hasMismatch?`<div style="background:rgba(255,140,0,.07);border:1px solid #553300;padding:7px 10px;font-size:12px;color:#cc7700;margin-top:8px">⚠ API assigned ${esc(VESSEL_DB[apiDroneMMSI]?.abbr||apiDroneMMSI)} — corrected to ${esc(VESSEL_DB[droneMMSI]?.abbr||droneMMSI)} based on launch site</div>`:''}
    ${uncertain?`<div class="mcard-uncertain">⚠ Launch window may shift — verify at <a href="https://nextspaceflight.com" target="_blank" style="color:inherit">nextspaceflight.com</a></div>`:''}
    ${vesselTLHTML}
    ${vesselListHTML}
    ${apiTLHTML}
  </div>`;
}

function openVesselFromMission(mmsi) {
  document.getElementById('missions-panel').style.display='none';
  selectVessel(mmsi);
}

// ── Suggestions ───────────────────────────────────────────────
function showSuggestModal() {
  const m=document.getElementById('suggestmodal');
  m.style.display='flex';
  m.onclick=e=>{if(e.target===m)closeSuggestModal();};
  document.getElementById('sg-msg').textContent='';
}
function closeSuggestModal() {
  document.getElementById('suggestmodal').style.display='none';
}

function showSources() {
  const m = document.getElementById('sourcesmodal');
  m.style.display = 'flex';
  m.onclick = e => { if(e.target===m) closeSources(); };
}
function closeSources() {
  document.getElementById('sourcesmodal').style.display = 'none';
}

async function submitSuggestion() {
  const type   =document.getElementById('sg-type').value;
  const name   =document.getElementById('sg-name').value.trim();
  const mmsi   =document.getElementById('sg-mmsi').value.trim();
  const notes  =document.getElementById('sg-notes').value.trim();
  const contact=document.getElementById('sg-contact').value.trim();
  const msg    =document.getElementById('sg-msg');

  if(!name && !mmsi) { msg.style.color='var(--hi)'; msg.textContent='Enter at least a vessel name or MMSI.'; return; }
  if(!SB.ready) { msg.style.color='var(--hi)'; msg.textContent='No database connected — suggestion cannot be saved.'; return; }

  msg.style.color='var(--t4)'; msg.textContent='Submitting…';
  try {
    await fetch(`${SB.url}/rest/v1/suggestions`, {
      method:'POST',
      headers:{ 'apikey':SB.akey, 'Authorization':`Bearer ${SB.akey}`,
                'Content-Type':'application/json', 'Prefer':'return=minimal' },
      body:JSON.stringify({ type, vessel_name:name||null, mmsi:mmsi||null, notes:notes||null, contact:contact||null }),
    });
    msg.style.color='var(--grn)'; msg.textContent='Submitted — thank you!';
    ['sg-name','sg-mmsi','sg-notes','sg-contact'].forEach(id=>document.getElementById(id).value='');
    setTimeout(closeSuggestModal, 1800);
  } catch(e) {
    msg.style.color='var(--hi)'; msg.textContent='Error: '+e.message;
  }
}

async function checkSuggestionsBadge() {
  if(!SB.ready) return;
  try {
    const r=await fetch(`${SB.url}/rest/v1/suggestions?status=eq.pending&select=id`,
      {headers:{'apikey':SB.akey,'Authorization':`Bearer ${SB.akey}`}});
    if(!r.ok) return;
    const rows=await r.json();
    const badge=document.getElementById('sg-badge');
    if(badge){badge.textContent=rows.length||''; badge.style.display=rows.length?'':'none';}
  } catch(e) {}
}

async function loadSuggestions() {
  const el=document.getElementById('sg-list');
  const count=document.getElementById('sg-count');
  if(!el) return;
  if(!SB.ready) { el.innerHTML='<div style="font-size:12px;color:var(--t4)">Supabase not configured.</div>'; return; }
  try {
    const r=await fetch(`${SB.url}/rest/v1/suggestions?status=eq.pending&order=ts.desc&limit=50`,
      {headers:{'apikey':SB.akey,'Authorization':`Bearer ${SB.akey}`}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows=await r.json();
    if(count) count.textContent=rows.length?`(${rows.length} pending)`:'(none)';
    const badge=document.getElementById('sg-badge');
    if(badge){badge.textContent=rows.length||''; badge.style.display=rows.length?'':'none';}
    if(!rows.length){el.innerHTML='<div style="font-size:12px;color:var(--t4)">No pending suggestions.</div>';return;}
    el.innerHTML=rows.map(s=>{
      const clip=`Type: ${s.type}\nVessel: ${s.vessel_name||'—'}\nMMSI: ${s.mmsi||'—'}\nNotes: ${s.notes||'—'}\nContact: ${s.contact||'—'}\nSubmitted: ${new Date(s.ts).toLocaleString()}`;
      return`<div id="sg-row-${s.id}" style="padding:10px 0;border-bottom:1px solid var(--bdr2)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:700;color:var(--acc);letter-spacing:.06em">${esc(s.type.replace('_',' ').toUpperCase())}</span>
          <span style="font-size:10px;color:var(--t4)">${new Date(s.ts).toLocaleString()}</span>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(clip).replace(/"/g,"'")})"
            style="margin-left:auto;background:none;border:1px solid var(--bdr);color:var(--t4);font-size:10px;padding:2px 8px;cursor:pointer">COPY</button>
          <button onclick="deleteSuggestion(${s.id})"
            style="background:none;border:1px solid var(--hi)44;color:var(--hi);font-size:10px;padding:2px 8px;cursor:pointer">DELETE</button>
        </div>
        ${s.vessel_name?`<div style="font-size:13px;font-weight:600;color:var(--t2)">${esc(s.vessel_name)}</div>`:''}
        ${s.mmsi?`<div style="font-size:12px;color:var(--acc);font-family:var(--fm)">${esc(s.mmsi)}</div>`:''}
        ${s.notes?`<div style="font-size:12px;color:var(--t);margin-top:3px;line-height:1.6">${esc(s.notes)}</div>`:''}
        ${s.contact?`<div style="font-size:11px;color:var(--t4);margin-top:3px">Contact: ${esc(s.contact)}</div>`:''}
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML=`<div style="font-size:12px;color:var(--hi)">Error loading suggestions: ${esc(e.message)}</div>`;
  }
}

async function deleteSuggestion(id) {
  if(!SB.ready) return;
  try {
    const r=await fetch(`${SB.url}/rest/v1/suggestions?id=eq.${id}`,
      {method:'DELETE',headers:{'apikey':SB.akey,'Authorization':`Bearer ${SB.akey}`}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const row=document.getElementById(`sg-row-${id}`);
    if(row) row.remove();
    const el=document.getElementById('sg-list');
    const count=document.getElementById('sg-count');
    if(el&&!el.children.length) el.innerHTML='<div style="font-size:12px;color:var(--t4)">No pending suggestions.</div>';
    const remaining=el?el.querySelectorAll('[id^=sg-row-]').length:0;
    if(count) count.textContent=remaining?`(${remaining} pending)`:'(none)';
    const badge=document.getElementById('sg-badge');
    if(badge){badge.textContent=remaining||''; badge.style.display=remaining?'':'none';}
  } catch(e) {
    alert('Delete failed: '+e.message+'\n\nYou may need to add a DELETE policy to your Supabase suggestions table:\ncreate policy "delete_suggestions" on suggestions for delete using (true);');
  }
}

// ── Share link ────────────────────────────────────────────────
function copyShareLink() {
  const url = `${location.origin}${location.pathname}?share`;
  navigator.clipboard.writeText(url).then(()=>{
    const msg=document.getElementById('share-link-msg');
    if(msg){msg.textContent='Copied ✓';setTimeout(()=>msg.textContent='',3000);}
  }).catch(()=>{
    const msg=document.getElementById('share-link-msg');
    if(msg) msg.textContent='Copy failed — check clipboard permissions';
  });
}

// ── Launch banner ─────────────────────────────────────────────
function renderLaunchBanner() {
  const banner=document.getElementById('launch-banner');
  if(!banner) return;
  const now=Date.now();
  const soon=missionsCache.find(l=>{
    const net=l.net?new Date(l.net).getTime():null;
    return net && net > now - 3600000 && net < now + 86400000;
  });
  if(!soon){banner.style.display='none';return;}
  const net=new Date(soon.net).getTime();
  const op=Object.entries(OPERATOR_MATCH).find(([k])=>(soon.launch_service_provider?.name||'').includes(k))?.[1]||'';
  const col=opColor(op);
  const vessels=vesselHintsForLaunch(op, soon.pad?.name||'', soon.pad?.location?.name||'');
  const droneMMSI=vessels.find(m=>{const r=(VESSEL_DB[m]?.role||'').toLowerCase();return r.includes('drone')||r.includes('landing platform');});
  const droneV=droneMMSI?VESSEL_DB[droneMMSI]:null;
  banner.style.display='flex';
  banner.style.background=`linear-gradient(90deg,${col}18 0%,var(--bg3) 100%)`;
  banner.style.borderColor=`var(--bdr)`;
  banner.style.borderLeftColor=col;
  banner.style.borderLeftWidth='3px';
  banner.innerHTML=
    `<span class="lb-label" style="color:${col}">⚡ LAUNCH</span>`+
    `<span class="lb-name" style="color:${col}">${esc(soon.name||'')}</span>`+
    `<span class="lb-cd" style="color:${col}" data-net="${net}">calculating…</span>`+
    (droneV?`<span class="lb-vessel" style="color:${opColor(droneV.operator)}" onclick="openVesselFromMission('${droneMMSI}');event.stopPropagation()">${esc(droneV.abbr||droneV.name)}</span>`:'');
  banner.onclick=()=>showMissions();
  startCountdowns();
}

// ── Util ──────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function tsStr(ts){
  if(!ts)return'—';
  const d=new Date(ts);
  return d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
function ageStr(ts){
  if(!ts)return'never';
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60)return s+'s ago';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m ago';
  return Math.floor(s/86400)+'d ago';
}

// ── Boot ─────────────────────────────────────────────────────
// ── VesselAPI static positions (GitHub Actions, updated every 2h) ─────────
async function loadVapiPositions() {
  try {
    const res = await fetch('data/vapi-positions.json?_='+Math.floor(Date.now()/7200000));
    if(!res.ok) return;
    const { fetched, vessels } = await res.json();
    const fetchedTs = fetched ? new Date(fetched).getTime() : 0;
    let added = 0;
    for(const [mmsi, vp] of Object.entries(vessels)) {
      if(!VESSEL_DB[mmsi]) continue;
      const existing = S.vessels[mmsi];
      const vpTs = vp.ts ? new Date(vp.ts).getTime() : 0;
      // most recent timestamp wins across all sources
      if(!existing?.lat || vpTs > (existing.ts||0)) {
        S.vessels[mmsi] = {
          mmsi, ...VESSEL_DB[mmsi],
          lat: vp.lat, lon: vp.lon,
          sog: vp.sog||0, cog: vp.cog||0,
          ts: vpTs,
          track: [],
          _vapi: true,
          _vapiAge: fetchedTs,
        };
        updateMarker(S.vessels[mmsi]);
        added++;
      }
    }
    if(added) { renderFleet(); addLog(`VesselAPI: +${added} positions from static snapshot (${new Date(fetchedTs).toLocaleTimeString()})`, 'sys'); }
  } catch(e) { /* vapi-positions.json not present */ }
}

window.onload=()=>{
  loadLS();

  if(SHARE_MODE) {
    document.body.classList.add('share-mode');
    const sub=document.getElementById('hsubtitle');
    if(sub) sub.textContent='GLOBAL FLEET · AIS + ADS-B · SPACEX · BLUE ORIGIN · ROCKET LAB · ULA';
  }

  SB.init();
  initTZSelect();
  initMap();
  renderOpLegend();
  if (localStorage.getItem('legend_collapsed') === '1') {
    const ops  = document.getElementById('mapleg-ops');
    const chev = document.getElementById('legend-chevron');
    if (ops)  ops.style.display  = 'none';
    if (chev) chev.textContent = '▸';
  }
  renderFleet();
  renderRight();
  updateHeaderStats();
  updateTerminator();
  setInterval(updateTerminator, 60000);
  setInterval(()=>{
    renderFleet(); updateHeaderStats(); updateTrajectoryArcs();
    // Show/hide OPS tab and auto-switch on launch entry (admin only)
    if (!SHARE_MODE) {
      const active = getActiveOpsLaunch();
      const opsBtn = document.getElementById('rtab-ops');
      if (opsBtn) opsBtn.style.display = active ? '' : 'none';
      if (active && active.id !== _opsAutoId) {
        _opsAutoId = active.id;
        if (S.tab === 'events') setTab('ops');
      }
    }
  }, 5000);

  // Single Supabase load → then realtime subscription + vapiPositions
  loadSBData().then(() => { loadVapiPositions(); initSBRealtime(); });
  setInterval(loadSBData, 15000); // poll every 15s — bulk query is cheap, matches vessel write throttle
  fetchMissionsBackground().then(()=>{ renderLaunchBanner(); updateBoosterProjections(); updateTrajectoryArcs(); });
  pollAircraft();
  setInterval(pollAircraft, AIRCRAFT_POLL_MS);
  fetchTLEs();
  fetchDockedManifest();
  setInterval(()=>{ fetchTLEs(); fetchDockedManifest(); }, 3600000);
  setInterval(()=>{ updateOrbits(); renderFleet(); }, 15000);

  if(!SHARE_MODE && !localStorage.getItem(LS.KEY)) showSettings();
  if(!SHARE_MODE && SB.ready) checkSuggestionsBadge();
  if(!SHARE_MODE && localStorage.getItem(LS.KEY)) setTimeout(()=>connect(localStorage.getItem(LS.KEY)), 4000);
};
// test
