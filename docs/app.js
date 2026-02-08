import * as satellite from "https://cdn.jsdelivr.net/npm/satellite.js@5.0.1/+esm";

"use strict";

// A known example TLE (ISS). It may not be “current”, but SGP4 propagation still works.
// Later we'll replace this with your Space-Track fetched TLEs.
const TLE_NAME = "ISS (ZARYA)";
const TLE_LINE1 = "1 25544U 98067A   24001.00000000  .00000000  00000-0  00000-0 0  9991";
const TLE_LINE2 = "2 25544  51.6420  20.0000 0005000  10.0000  20.0000 15.50000000100001";

const outEl = document.getElementById("out");
const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");

function fmt(n, digits = 3) {
  if (!Number.isFinite(n)) return "NaN";
  return n.toFixed(digits);
}

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function propagateAndPrint(date) {
  // 1) Parse TLE -> satrec
  const satrec = satellite.twoline2satrec(TLE_LINE1, TLE_LINE2);

  // 2) Propagate to ECI (km)
  const pv = satellite.propagate(satrec, date);
  if (!pv.position || !pv.velocity) {
    throw new Error("Propagation failed (position/velocity missing).");
  }

  const gmst = satellite.gstime(date);

  // 3) Convert ECI -> ECF
  const ecf = satellite.eciToEcf(pv.position, gmst);

  // 4) Convert ECF -> geodetic lat/lon/height
  const geo = satellite.eciToGeodetic(pv.position, gmst);
  const latDeg = toDeg(geo.latitude);
  const lonDeg = toDeg(geo.longitude);
  const hKm = geo.height;

  // 5) Print
  const lines = [];
  lines.push(`Satellite: ${TLE_NAME}`);
  lines.push(`TLE:`);
  lines.push(`  ${TLE_LINE1}`);
  lines.push(`  ${TLE_LINE2}`);
  lines.push("");
  lines.push(`Date (UTC): ${date.toISOString()}`);
  lines.push("");
  lines.push("ECI position (km):");
  lines.push(`  x=${fmt(pv.position.x)}  y=${fmt(pv.position.y)}  z=${fmt(pv.position.z)}`);
  lines.push("ECI velocity (km/s):");
  lines.push(`  xdot=${fmt(pv.velocity.x, 6)}  ydot=${fmt(pv.velocity.y, 6)}  zdot=${fmt(pv.velocity.z, 6)}`);
  lines.push("");
  lines.push("ECF position (km):");
  lines.push(`  x=${fmt(ecf.x)}  y=${fmt(ecf.y)}  z=${fmt(ecf.z)}`);
  lines.push("");
  lines.push("Geodetic subpoint:");
  lines.push(`  lat=${fmt(latDeg, 4)} deg`);
  lines.push(`  lon=${fmt(lonDeg, 4)} deg`);
  lines.push(`  height=${fmt(hKm, 4)} km`);

  outEl.textContent = lines.join("\n");
}

function runOnce() {
  try {
    statusEl.textContent = "Running…";
    const now = new Date();
    propagateAndPrint(now);
    statusEl.textContent = "OK";
  } catch (e) {
    statusEl.textContent = "Error";
    outEl.textContent = String(e && e.message ? e.message : e);
  }
}

runBtn.addEventListener("click", runOnce);
runOnce(); // run on load