# sat-sky

https://thomdela.github.io/sat-sky/

**sat-sky** is a small web app that shows **satellites currently visible** from a given observer location.

It focuses on a simple workflow:
1) choose a location (GPS or city)
2) choose a time (now by default)
3) compute satellite positions and visibility
4) display a sky view + a sortable list (name, altitude, azimuth, range, brightness/estimate when available)

This project is currently **work in progress**.

---

## Features (planned)

- **Observer location**
  - GPS / manual lat-lon-alt
  - optional city search / map picker
- **Time**
  - “Now” and custom UTC time
- **Visibility**
  - Alt/Az computation (topocentric)
  - horizon mask (min altitude)
  - daylight / twilight options
  - optional line-of-sight constraints
- **Data sources**
  - TLE ingestion (CelesTrak / Space-Track / local file)
  - caching & auto-refresh
- **UI**
  - list of visible satellites sorted by altitude
  - sky plot (polar / horizon view)
  - click a satellite → details (orbit age, next pass, etc.)

---

## Tech stack (draft)

- Backend: Python (FastAPI) for propagation + visibility
- Propagation: SGP4 (TLE)
- Coordinates: Astropy (or direct transforms if needed for speed)
- Frontend: simple SPA (TBD) + sky visualization

---

## Development (placeholder)

Clone the repo:

```bash
git clone https://github.com/ThomDELA/sat-sky.git
cd sat-sky