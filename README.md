# Space Vessel Intel

Real-time AIS tracking of vessels supporting commercial and government space launch operations. Tracks drone ships, recovery boats, transport vessels, and range support ships for SpaceX, Blue Origin, Rocket Lab, ULA, ESA, and US Space Force.

Live at: **https://karl-dykema.github.io/space-intel/**

---

## Features

- **Live AIS tracking** via [aisstream.io](https://aisstream.io) WebSocket — subscribes to all known MMSIs globally
- **Persistent history** via Supabase PostgreSQL — positions and events survive page reloads
- **Mission linkage** — upcoming launches from The Space Devs API linked to their assigned vessels
- **Launch banner** — prominent countdown strip when a mission is within 24 hours
- **Share mode** (`?share&sb_url=...&sb_key=...`) — public read-only view, no AIS key required
- **Geofences** — automatic zone enter/exit events (Cape Canaveral, Vandenberg, Starbase, Mahia, recovery zones)
- **Vessel detail** — MMSI, IMO, specs, history, upcoming missions, external lookups

---

## Setup

1. Get a free API key at [aisstream.io/authenticate](https://aisstream.io/authenticate)
2. Open the app and click **⚙ SETTINGS**
3. Paste the key and click **SAVE & APPLY**

**Optional — Supabase persistence:**
1. Create a free project at [supabase.com](https://supabase.com)
2. Open SQL Editor and run `supabase_schema.sql`
3. Paste your project URL and anon key in ⚙ SETTINGS

**Share link:**  
Click **COPY SHARE LINK** in Settings to generate a URL that embeds your Supabase read credentials. Recipients see the full map and vessel data — admin controls are hidden.

---

## Fleet Coverage

### SpaceX
| Vessel | MMSI | Role |
|--------|------|------|
| A Shortfall of Gravitas (ASOG) | 368219910 | ASDS — East Coast / Gulf (LC-39A, SLC-40) |
| Just Read the Instructions (JRTI) | 368219920 | Drone ship / Starship support (Boca Chica) |
| Of Course I Still Love You (OCISLY) | 368351350 | ASDS — West Coast (Vandenberg SLC-4E) |
| GO Searcher | 366584000 | Recovery / crew support |
| GO Navigator | 367550000 | Recovery / crew support |
| Bob | 367578000 | Fast recovery boat |
| Doug | 367120400 | Fast recovery boat |
| Jacklyn | 368368960 | Starship recovery (Blue Origin charter) |

### Blue Origin
| Vessel | MMSI | Role |
|--------|------|------|
| Jacklyn | 368368960 | New Glenn booster recovery ship |

### Rocket Lab
| Vessel | MMSI | Role |
|--------|------|------|
| Seaworker | 512440000 | Recovery ship — Mahia, NZ |
| Sea Surveyor | 512385000 | Recovery / range support |

### ULA
| Vessel | MMSI | Role |
|--------|------|------|
| Harvey Stone | 369045000 | Range support / transport |

### ESA / Arianespace
| Vessel | MMSI | Role |
|--------|------|------|
| Canopée | 228438700 | Ariane 6 rocket component transport |
| MN Colibri | 228057000 | Arianespace component transport |
| MN Toucan | 227278000 | Arianespace component transport |

### The Spaceport Company
| Vessel | MMSI | Role |
|--------|------|------|
| Once in a Lifetime | 369857000 | Sea-based mobile launch platform (unverified) |

### US Space Force Range (Military Sealift Command)
| Vessel | MMSI | Role |
|--------|------|------|
| USNS Howard O. Lorenzen (T-AGM-25) | 369998000 | Missile/range instrumentation — Cobra King radar |
| USNS Invincible (T-AGM-24) | 338941000 | Missile/range instrumentation |
| SBX-1 | 369468000 | Sea-based X-band radar platform (Pearl Harbor) |

---

## Files

| File | Description |
|------|-------------|
| `index.html` | App shell, meta tags, layout |
| `styles.css` | All styling |
| `vessels.js` | Vessel database, zones, operator config, constants |
| `app.js` | AIS WebSocket, Supabase client, map, UI logic |
| `supabase_schema.sql` | Database schema for position history + events |

---

## Future / Research

### Aircraft tracking (ADS-B)
Space operations involve trackable aircraft that would complement vessel tracking:

- **Rocket Lab ZK-HEV** — Sikorsky S-92A, used for mid-air Electron booster recovery off NZ
- **Blue Origin recovery helicopter** — catches New Shepard capsules after descent
- **SpaceX Gulfstreams** (N628TS, N629TS etc.) — crew/executive transport, often position near launch sites pre-launch
- **SpaceX chase planes** — track booster descents

ADS-B data sources to evaluate:
- [OpenSky Network](https://opensky-network.org) — free REST API, no WebSocket key needed
- [ADS-B Exchange](https://www.adsbexchange.com) — unfiltered, includes military
- [FlightAware AeroAPI](https://flightaware.com/commercial/aeroapi/) — paid, higher fidelity

Integration would require: a second data source alongside AIS, a way to display aircraft icons on the same Leaflet map (different icon shape, altitude label), and registration-to-callsign resolution. The OpenSky API returns lat/lon/altitude/velocity and is REST-based — could poll every 15–30s for the known registrations.

---

## MMSI Verification

All MMSIs marked `[✓ MMSI]` in vessel notes are confirmed via MarineTraffic or vesseltracker.com.  
Vessels marked `verified: false` need confirmation — check [marinetraffic.com](https://www.marinetraffic.com) or [vesselfinder.com](https://www.vesselfinder.com).
