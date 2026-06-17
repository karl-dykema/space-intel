'use strict';

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
let calendarCache = [], _calView = 'calendar';
let _calYear = new Date().getFullYear(), _calMonth = new Date().getMonth();
let _calSelectedDay = null, _calByDay = {};
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
  if (_calView === 'calendar') { renderMissionsCalendar(); return; }

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

  if(SHARE_MODE) {
    if (missionsCache.length) {
      document.getElementById('missions-src').textContent = `${missionsCache.length} upcoming · Supabase cache`;
      document.getElementById('missions-content').innerHTML =
        `<div style="padding:10px 18px 6px;font-size:11px;font-weight:700;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--bdr2)">UPCOMING</div>` +
        missionsCache.map(buildMissionCard).join('');
      startCountdowns();
    } else {
      document.getElementById('missions-src').textContent = 'Loading from database…';
      document.getElementById('missions-content').innerHTML =
        '<div style="padding:20px;color:var(--t4);font-size:13px">Mission data loading…</div>';
    }
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

  return `<div class="mcard" data-mid="${esc(l.id||'')}" style="border-left-color:${col}">
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

// ── Calendar view ─────────────────────────────────────────────
function _calOpColor(l) {
  const lsp = l.launch_service_provider?.name || '';
  const op = Object.entries(OPERATOR_MATCH).find(([k]) => lsp.includes(k))?.[1];
  if (op) return opColor(op);
  if (/NASA|Boeing|Northrop/i.test(lsp))    return '#3388ff';
  if (/Roscosmos|Soyuz/i.test(lsp))         return '#cc4444';
  if (/JAXA|Mitsubishi|MHI/i.test(lsp))     return '#dd7700';
  if (/ISRO/i.test(lsp))                    return '#ff9933';
  if (/ESA|Arianespace|ArianeGroup/i.test(lsp)) return '#7755ff';
  if (/CNSA|Long March/i.test(lsp))         return '#dd2222';
  return '#556677';
}

async function fetchCalendarData() {
  if (!SB.init()) { addLog('Calendar: Supabase not configured', 'sys'); return; }
  try {
    const [calRows, detRows, pastRows] = await Promise.all([
      SB.select('app_cache', { key: 'eq.launches.upcoming' }),
      SB.select('app_cache', { key: 'eq.launches.detailed' }),
      SB.select('app_cache', { key: 'eq.launches.past' }),
    ]);
    if (calRows?.length && calRows[0].data?.length) {
      calendarCache = calRows[0].data;
      const ageH = calRows[0].fetched_at
        ? ((Date.now() - new Date(calRows[0].fetched_at).getTime()) / 3600000).toFixed(1) : '?';
      addLog(`Calendar: ${calendarCache.length} launches · data ${ageH}h old`, 'sys');
    } else {
      addLog('Calendar: no data in DB — run Fetch Launch Calendar Action', 'sys');
    }
    // Full detailed upcoming → missionsCache (rich mission cards + booster detection)
    if (detRows?.length && detRows[0].data?.length) {
      missionsCache = detRows[0].data;
      addLog(`Missions: ${missionsCache.length} upcoming (full data from DB cache)`, 'sys');
      // Refresh the panel if it's already open (user opened before data arrived)
      const panel = document.getElementById('missions-panel');
      if (panel && panel.style.display !== 'none' && _calView !== 'calendar') showMissions();
    }
    // Full detailed past → pastMissionsCache (booster-aboard detection for returning ships)
    if (pastRows?.length && pastRows[0].data?.length) {
      pastMissionsCache = pastRows[0].data;
      addLog(`Missions past: ${pastMissionsCache.length} recent (from DB cache)`, 'sys');
    }
  } catch(e) {
    addLog(`Calendar: ${e.message}`, 'err');
  }
}

async function renderMissionsCalendar() {
  const content = document.getElementById('missions-content');
  const src     = document.getElementById('missions-src');
  if (!calendarCache.length) {
    content.innerHTML = '<div style="padding:24px;color:var(--t4)">Loading…</div>';
    await fetchCalendarData();
  }
  src.textContent = `${calendarCache.length} launches · all agencies · The Space Devs API`;
  _calByDay = {};
  for (const l of calendarCache) {
    if (!l.net) continue;
    const d = new Date(l.net);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    (_calByDay[k] = _calByDay[k] || []).push(l);
  }
  content.innerHTML = _buildCalGrid() + _buildCalDayDetail();
}

function _buildCalGrid() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const y = _calYear, m = _calMonth;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const monthName = new Date(y, m, 1).toLocaleString('default', { month: 'long' });
  const DAYS = ['S','M','T','W','T','F','S'];

  let html = `<div style="padding:10px 12px 0">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <button onclick="calNav(-1)" style="background:#1a2535;border:1px solid var(--bdr2);color:var(--t3);width:28px;height:28px;cursor:pointer;font-size:15px;border-radius:2px;line-height:1">‹</button>
      <div style="font-size:13px;font-weight:700;color:var(--t);letter-spacing:.06em">${monthName.toUpperCase()} ${y}</div>
      <button onclick="calNav(1)"  style="background:#1a2535;border:1px solid var(--bdr2);color:var(--t3);width:28px;height:28px;cursor:pointer;font-size:15px;border-radius:2px;line-height:1">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">
      ${DAYS.map(d=>`<div style="text-align:center;font-size:9px;color:var(--t5);padding:2px 0;font-weight:700;letter-spacing:.08em">${d}</div>`).join('')}`;

  for (let i = 0; i < firstDay; i++)
    html += `<div style="background:rgba(255,255,255,.015);border-radius:2px;min-height:50px"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const launches = _calByDay[dateStr] || [];
    const isToday = dateStr === todayStr;
    const isSel   = dateStr === _calSelectedDay;
    const bg   = isSel ? 'rgba(255,136,0,.13)' : isToday ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.015)';
    const ring = isSel ? '1.5px solid rgba(255,136,0,.55)' : isToday ? '1px solid rgba(255,255,255,.12)' : '1px solid transparent';
    const numCol = (isToday || isSel) ? '#ff8800' : 'var(--t5)';
    const dots = launches.slice(0,3).map(l =>
      `<span style="width:5px;height:5px;border-radius:50%;background:${_calOpColor(l)};display:inline-block;margin:0 1px 1px 0" title="${esc(l.name||'')}"></span>`
    ).join('');
    const more = launches.length > 3 ? `<span style="font-size:8px;color:var(--t5)">+${launches.length-3}</span>` : '';
    html += `<div onclick="${launches.length?`calClickDay('${dateStr}')`:''}"
      style="background:${bg};border:${ring};border-radius:2px;min-height:50px;padding:3px 4px;cursor:${launches.length?'pointer':'default'};box-sizing:border-box">
      <div style="font-size:10px;color:${numCol};text-align:right;font-weight:${isToday?'700':'400'}">${day}</div>
      <div style="display:flex;flex-wrap:wrap;margin-top:3px">${dots}${more}</div>
    </div>`;
  }

  const trail = (7 - ((firstDay + daysInMonth) % 7)) % 7;
  for (let i = 0; i < trail; i++)
    html += `<div style="background:rgba(255,255,255,.015);border-radius:2px;min-height:50px"></div>`;

  const legend = [
    ['SpaceX','#00d4ff'],['Rocket Lab',opColor('Rocket Lab')],['Blue Origin',opColor('Blue Origin')],
    ['ULA',opColor('ULA')],['NASA','#3388ff'],['ESA/Ariane','#7755ff'],['ROSCOSMOS','#cc4444'],['Other','#556677'],
  ];
  html += `</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 0 4px">
      ${legend.map(([n,c])=>`<span style="display:flex;align-items:center;gap:3px;font-size:9px;color:var(--t5)">
        <span style="width:6px;height:6px;border-radius:50%;background:${c};display:inline-block;flex-shrink:0"></span>${n}
      </span>`).join('')}
    </div>
  </div>`;
  return html;
}

function _buildCalDayDetail() {
  if (!_calSelectedDay || !_calByDay[_calSelectedDay]?.length) return '<div id="cal-day-detail"></div>';
  const launches = _calByDay[_calSelectedDay];
  const d = new Date(_calSelectedDay + 'T12:00:00');
  const label = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const items = launches.map(l => {
    const col    = _calOpColor(l);
    const lsp    = l.launch_service_provider?.abbrev || l.launch_service_provider?.name || '';
    const net    = l.net ? fmtTime(new Date(l.net).getTime()) : 'TBD';
    const veh    = l.rocket?.configuration?.name || '';
    const status = l.status?.name || '';
    const scol   = /Go|Success/i.test(status)?'#00ff88':/Hold|Delay/i.test(status)?'#ff4444':'var(--t5)';
    return `<div onclick="calMissionClick('${esc(l.id||'')}')"
      onmouseenter="this.style.background='rgba(255,136,0,.07)'" onmouseleave="this.style.background=''"
      style="display:flex;gap:9px;align-items:flex-start;padding:8px 14px;border-bottom:1px solid var(--bdr2);cursor:pointer">
      <span style="width:7px;height:7px;border-radius:50%;background:${col};flex-shrink:0;margin-top:3px"></span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--t);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.name||'Unknown Mission')}</div>
        <div style="font-size:10px;color:var(--t4);margin-top:2px">${esc(lsp)}${veh?' · '+esc(veh):''} · ${esc(net)} · <span style="color:${scol}">${esc(status)}</span></div>
      </div>
    </div>`;
  }).join('');
  return `<div id="cal-day-detail" style="border-top:2px solid rgba(255,136,0,.3);margin-top:2px">
    <div style="padding:7px 14px;font-size:11px;font-weight:700;color:#ff8800;letter-spacing:.07em;text-transform:uppercase">${esc(label)} — ${launches.length} LAUNCH${launches.length>1?'ES':''}</div>
    ${items}
  </div>`;
}

function calNav(delta) {
  _calMonth += delta;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
  _calSelectedDay = null;
  renderMissionsCalendar();
}

function calClickDay(dateStr) {
  _calSelectedDay = _calSelectedDay === dateStr ? null : dateStr;
  renderMissionsCalendar();
}

function calMissionClick(id) {
  if (!id) return;
  const l = calendarCache.find(x => x.id === id);
  if (!l) return;
  _showCalMissionPopup(l);
}

function closeCalMissionPopup() {
  const el = document.getElementById('cal-mission-popup');
  if (el) el.remove();
}

function _openListToMission(id) {
  setMissionsView('list');
  const tryScroll = (attempts = 0) => {
    const el = document.querySelector(`[data-mid="${id}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (attempts < 12) setTimeout(() => tryScroll(attempts + 1), 120);
  };
  setTimeout(tryScroll, 200);
}

function _showCalMissionPopup(l) {
  closeCalMissionPopup();
  const col     = _calOpColor(l);
  const net     = l.net ? new Date(l.net).getTime() : null;
  const netStr  = net ? fmtTime(net) : 'TBD';
  const status  = l.status || '';
  const scol    = /Go|Success/i.test(status) ? '#00ff88' : /Hold|Delay/i.test(status) ? '#ff4444' : '#ff8800';
  const lspName = l.lsp || '';
  const lspAbbr = l.lspAbbr || lspName;
  const vehicle = l.vehicle || '';
  const isTracked = !SHARE_MODE && Object.keys(OPERATOR_MATCH).some(k => lspName.includes(k));
  const watchLinks = getLaunchWatchLinks(Object.entries(OPERATOR_MATCH).find(([k]) => lspName.includes(k))?.[1] || '');

  const overlay = document.createElement('div');
  overlay.id = 'cal-mission-popup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.onclick = e => { if (e.target === overlay) closeCalMissionPopup(); };

  overlay.innerHTML = `
    <div style="background:var(--bg2);border:1px solid ${col}44;border-top:3px solid ${col};border-radius:4px;max-width:460px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.8)">
      <div style="padding:16px 18px 12px;background:linear-gradient(180deg,${col}16 0%,transparent 90px)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;color:${col};text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:4px">${esc(lspAbbr)}${vehicle?' · '+esc(vehicle):''}</div>
            <div style="font-size:16px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:8px">${esc(l.name||'Unknown Mission')}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <span style="font-size:10px;padding:2px 8px;background:${scol}22;border:1px solid ${scol}44;color:${scol};border-radius:2px">${esc(status)}</span>
              ${lspAbbr !== lspName ? `<span style="font-size:10px;padding:2px 8px;background:${col}18;border:1px solid ${col}33;color:${col};border-radius:2px">${esc(lspName)}</span>` : ''}
            </div>
          </div>
          <button onclick="closeCalMissionPopup()" style="background:none;border:none;color:var(--t4);font-size:18px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;margin-top:-2px">✕</button>
        </div>
      </div>
      <div style="padding:0 18px 16px">
        <div style="padding:10px 0;border-top:1px solid var(--bdr2)">
          <div style="font-size:10px;color:var(--t5);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">NET LAUNCH</div>
          <div style="font-size:15px;font-weight:600;color:var(--t);margin-bottom:4px">${esc(netStr)}</div>
          ${net ? `<div style="font-size:13px;color:${col};font-family:var(--fm)" data-net="${net}">calculating…</div>` : ''}
        </div>
        ${(l.pad||l.loc) ? `<div style="padding:10px 0;border-top:1px solid var(--bdr2)">
          <div style="font-size:10px;color:var(--t5);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">LAUNCH SITE</div>
          <div style="font-size:13px;color:var(--t2)">${esc(l.pad||'')}${l.pad&&l.loc?' · ':''}${esc(l.loc||'')}</div>
        </div>` : ''}
        ${watchLinks.length ? `<div style="padding:10px 0;border-top:1px solid var(--bdr2);display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:10px;color:var(--t4);letter-spacing:.06em">WATCH</span>
          ${watchLinks.map(w=>`<a href="${esc(w.url)}" target="_blank" style="font-size:11px;font-weight:600;padding:4px 10px;background:${col}20;border:1px solid ${col}44;color:${col};text-decoration:none;border-radius:2px;white-space:nowrap">▶ ${esc(w.label)}</a>`).join('')}
        </div>` : ''}
        ${isTracked ? `<div style="padding:12px 0 0;border-top:1px solid var(--bdr2)">
          <button onclick="closeCalMissionPopup();_openListToMission('${esc(l.id||'')}')"
            style="font-size:11px;font-weight:700;padding:6px 14px;background:#0a1e30;border:1px solid ${col}55;color:${col};cursor:pointer;letter-spacing:.05em;border-radius:2px">
            VIEW FULL DETAILS ↗
          </button>
        </div>` : ''}
      </div>
    </div>`;

  document.body.appendChild(overlay);
  startCountdowns();
}

function setMissionsView(mode) {
  _calView = mode;
  const listBtn = document.getElementById('mview-list');
  const calBtn  = document.getElementById('mview-cal');
  if (listBtn && calBtn) {
    const on  = { background:'#1a2535', borderColor:'#ff8800', color:'#ff8800' };
    const off = { background:'var(--bg4)', borderColor:'var(--bdr2)', color:'var(--t4)' };
    Object.assign(listBtn.style, mode === 'list'     ? on : off);
    Object.assign(calBtn.style,  mode === 'calendar' ? on : off);
  }
  if (mode === 'calendar') renderMissionsCalendar();
  else showMissions();
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

