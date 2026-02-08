"use strict";

// A known example TLE (ISS). It may not be “current”, but SGP4 propagation still works.
// Later we'll replace this with your Space-Track fetched TLEs.
const TLE_NAME = "ISS (ZARYA)";
const TLE_LINE1 = "1 25544U 98067A   24001.00000000  .00000000  00000-0  00000-0 0  9991";
const TLE_LINE2 = "2 25544  51.6420  20.0000 0005000  10.0000  20.0000 15.50000000100001";

const outEl = document.getElementById("out");
const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");

let satelliteLib = null;

function fmt(n, digits = 3) {
  if (!Number.isFinite(n)) return "NaN";
  return n.toFixed(digits);
}

function toDeg(rad) {
  return rad * 180 / Math.PI;
}

function appendTrace(lines, label, value) {
  lines.push(`${label}: ${value}`);
}

async function loadSatelliteLib(traceLines) {
  if (satelliteLib) {
    appendTrace(traceLines, "Library", "satellite.js already loaded");
    return satelliteLib;
  }

  const sources = [
    "https://cdn.jsdelivr.net/npm/satellite.js/+esm",
    "https://unpkg.com/satellite.js/dist/satellite.es.js"
  ];

  for (const src of sources) {
    try {
      appendTrace(traceLines, "Trying module", src);
      const mod = await import(src);
      satelliteLib = mod.default ?? mod;
      appendTrace(traceLines, "Module load", "success");
      return satelliteLib;
    } catch (err) {
      appendTrace(traceLines, "Module load error", `${src} -> ${String(err?.message || err)}`);
    }
  }

  throw new Error("Unable to load satellite.js from CDN sources.");
}

function propagateAndPrint(date, sat, traceLines) {
  appendTrace(traceLines, "Step 1", "Parse TLE into satrec");
  const satrec = sat.twoline2satrec(TLE_LINE1, TLE_LINE2);
  appendTrace(traceLines, "satrec.satnum", satrec.satnum);

  appendTrace(traceLines, "Step 2", "Propagate to ECI");
  const pv = sat.propagate(satrec, date);
  if (!pv.position || !pv.velocity) {
    throw new Error("Propagation failed (position/velocity missing).");
  }

  appendTrace(traceLines, "Step 3", "Compute GMST");
  const gmst = sat.gstime(date);

  appendTrace(traceLines, "Step 4", "Convert ECI -> ECF");
  const ecf = sat.eciToEcf(pv.position, gmst);

  appendTrace(traceLines, "Step 5", "Convert ECI -> geodetic");
  const geo = sat.eciToGeodetic(pv.position, gmst);
  const latDeg = toDeg(geo.latitude);
  const lonDeg = toDeg(geo.longitude);
  const hKm = geo.height;

  const lines = [];
  lines.push(`Satellite: ${TLE_NAME}`);
  lines.push("TLE:");
  lines.push(`  ${TLE_LINE1}`);
  lines.push(`  ${TLE_LINE2}`);
  lines.push("");
  lines.push(`Date (UTC): ${date.toISOString()}`);
  lines.push("");
  lines.push("Computation trace:");
  for (const entry of traceLines) {
    lines.push(`  - ${entry}`);
  }
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

async function runOnce() {
  const traceLines = [];
  try {
    statusEl.textContent = "Running…";
    appendTrace(traceLines, "Status", "Starting propagation pipeline");

    const sat = await loadSatelliteLib(traceLines);
    const now = new Date();
    appendTrace(traceLines, "Input date", now.toISOString());

    propagateAndPrint(now, sat, traceLines);
    statusEl.textContent = "OK";
  } catch (e) {
    statusEl.textContent = "Error";
    const details = String(e?.message || e);
    outEl.textContent = [
      "Computation failed.",
      "",
      ...traceLines.map((entry) => `- ${entry}`),
      "",
      `Error: ${details}`
    ].join("\n");
  }
}

runBtn.addEventListener("click", () => {
  void runOnce();
});

void runOnce(); // run on load
