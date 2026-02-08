"use strict";

const ids = {
  obsLat: document.getElementById("obs-lat"),
  obsLon: document.getElementById("obs-lon"),
  obsAlt: document.getElementById("obs-alt"),
  startTime: document.getElementById("start-time"),
  spanMin: document.getElementById("span-min"),
  stepMin: document.getElementById("step-min"),
  tleInput: document.getElementById("tle-input"),
  plot: document.getElementById("plot"),
  status: document.getElementById("status"),
  out: document.getElementById("out"),
  canvas: document.getElementById("sky-canvas")
};

const ctx = ids.canvas.getContext("2d");
const palette = ["#0284c7", "#16a34a", "#9333ea", "#ea580c", "#dc2626", "#0f766e", "#7c3aed"];
let satelliteLib = null;

function setDefaultStartTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  ids.startTime.value = now.toISOString().slice(0, 16);
}

function seedDefaultTle() {
  ids.tleInput.value = [
    "ISS (ZARYA)",
    "1 25544U 98067A   24001.00000000  .00000000  00000-0  00000-0 0  9991",
    "2 25544  51.6420  20.0000 0005000  10.0000  20.0000 15.50000000100001",
    "",
    "NOAA 15",
    "1 25338U 98030A   24001.00000000  .00000080  00000-0  69453-4 0  9998",
    "2 25338  98.7393 344.7483 0011301  99.1789 261.0745 14.25907866344484"
  ].join("\n");
}

async function loadSatelliteLib() {
  if (satelliteLib) return satelliteLib;

  const sources = [
    "https://cdn.jsdelivr.net/npm/satellite.js/+esm",
    "https://unpkg.com/satellite.js/dist/satellite.es.js"
  ];

  for (const src of sources) {
    try {
      const mod = await import(src);
      satelliteLib = mod.default ?? mod;
      return satelliteLib;
    } catch {
      // Try next CDN source.
    }
  }

  throw new Error("Unable to load satellite.js from CDN.");
}

function parseTleBlocks(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const objects = [];
  let i = 0;
  while (i < lines.length) {
    const current = lines[i];
    const next = lines[i + 1];
    const afterNext = lines[i + 2];

    if (current?.startsWith("1 ") && next?.startsWith("2 ")) {
      objects.push({ name: `Object ${objects.length + 1}`, line1: current, line2: next });
      i += 2;
      continue;
    }

    if (next?.startsWith("1 ") && afterNext?.startsWith("2 ")) {
      objects.push({ name: current, line1: next, line2: afterNext });
      i += 3;
      continue;
    }

    throw new Error(`Could not parse TLE near line ${i + 1}: "${current}"`);
  }

  if (!objects.length) {
    throw new Error("No valid TLE objects found.");
  }

  return objects;
}

function deg2rad(deg) {
  return deg * Math.PI / 180;
}

function skyPoint(azDeg, altDeg, radius) {
  const r = ((90 - altDeg) / 90) * radius;
  const azRad = deg2rad(azDeg);
  return {
    x: r * Math.sin(azRad),
    y: -r * Math.cos(azRad)
  };
}

function drawSkyGrid(cx, cy, radius) {
  ctx.clearRect(0, 0, ids.canvas.width, ids.canvas.height);
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = "#f8fbff";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  [radius, (2 * radius) / 3, radius / 3].forEach((r, idx) => {
    ctx.strokeStyle = idx === 0 ? "#475569" : "#cbd5e1";
    ctx.lineWidth = idx === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-radius, 0);
  ctx.lineTo(radius, 0);
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, radius);
  ctx.stroke();

  ctx.fillStyle = "#334155";
  ctx.font = "12px system-ui";
  ctx.fillText("N", -4, -radius - 8);
  ctx.fillText("E", radius + 6, 4);
  ctx.fillText("S", -4, radius + 18);
  ctx.fillText("W", -radius - 14, 4);
  ctx.restore();
}

function drawLegend(entries) {
  const x = 14;
  const y = 14;
  const lineHeight = 18;
  const boxWidth = Math.min(ids.canvas.width - 24, 280);
  const boxHeight = 12 + entries.length * lineHeight;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeRect(x, y, boxWidth, boxHeight);

  ctx.font = "12px system-ui";
  entries.forEach((entry, idx) => {
    const rowY = y + 20 + idx * lineHeight;
    ctx.fillStyle = entry.color;
    ctx.fillRect(x + 8, rowY - 8, 14, 4);
    ctx.fillStyle = "#0f172a";
    ctx.fillText(entry.name.slice(0, 32), x + 28, rowY);
  });
  ctx.restore();
}

function propagateSeries(sat, satrec, observerGd, startDate, spanMin, stepMin) {
  const points = [];

  for (let minute = 0; minute <= spanMin; minute += stepMin) {
    const date = new Date(startDate.getTime() + minute * 60000);
    const pv = sat.propagate(satrec, date);
    if (!pv.position) continue;

    const gmst = sat.gstime(date);
    const positionEcf = sat.eciToEcf(pv.position, gmst);
    const look = sat.ecfToLookAngles(observerGd, positionEcf);
    const altDeg = look.elevation * 180 / Math.PI;
    const azDeg = (look.azimuth * 180 / Math.PI + 360) % 360;

    points.push({ minute, altDeg, azDeg });
  }

  return points;
}

function splitVisiblePasses(points) {
  const passes = [];
  let currentPass = [];

  points.forEach((point) => {
    if (point.altDeg >= 0) {
      currentPass.push(point);
    } else if (currentPass.length > 0) {
      passes.push(currentPass);
      currentPass = [];
    }
  });

  if (currentPass.length > 0) {
    passes.push(currentPass);
  }

  return passes;
}

async function plot() {
  try {
    ids.status.textContent = "Plotting…";
    const sat = await loadSatelliteLib();

    const observer = {
      latDeg: Number(ids.obsLat.value),
      lonDeg: Number(ids.obsLon.value),
      altM: Number(ids.obsAlt.value)
    };

    const spanMin = Math.max(10, Number(ids.spanMin.value) || 180);
    const stepMin = Math.max(1, Number(ids.stepMin.value) || 2);
    const startDate = ids.startTime.value ? new Date(ids.startTime.value) : new Date();
    const parsed = parseTleBlocks(ids.tleInput.value);

    const observerGd = {
      latitude: observer.latDeg * Math.PI / 180,
      longitude: observer.lonDeg * Math.PI / 180,
      height: observer.altM / 1000
    };

    const cx = ids.canvas.width / 2;
    const cy = ids.canvas.height / 2;
    const radius = Math.min(cx, cy) - 28;
    drawSkyGrid(cx, cy, radius);

    const summaries = [];
    const legendEntries = [];

    ctx.save();
    ctx.translate(cx, cy);

    parsed.forEach((obj, idx) => {
      const satrec = sat.twoline2satrec(obj.line1, obj.line2);
      const points = propagateSeries(sat, satrec, observerGd, startDate, spanMin, stepMin);
      const visible = points.filter((point) => point.altDeg >= 0);
      const visiblePasses = splitVisiblePasses(points);
      const color = palette[idx % palette.length];

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      visiblePasses.forEach((pass) => {
        if (pass.length <= 1) return;
        ctx.beginPath();
        pass.forEach((point, pointIndex) => {
          const pos = skyPoint(point.azDeg, point.altDeg, radius);
          if (pointIndex === 0) {
            ctx.moveTo(pos.x, pos.y);
          } else {
            ctx.lineTo(pos.x, pos.y);
          }
        });
        ctx.stroke();
      });

      if (visible.length > 0) {
        const last = visible[visible.length - 1];
        const mark = skyPoint(last.azDeg, last.altDeg, radius);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mark.x, mark.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      legendEntries.push({ name: obj.name, color });
      summaries.push(`${obj.name}: ${visible.length}/${points.length} samples above horizon`);
    });

    ctx.restore();
    drawLegend(legendEntries);

    ids.out.textContent = [
      `Start (UTC-ish local input): ${startDate.toISOString()}`,
      `Observer: lat=${observer.latDeg.toFixed(4)}°, lon=${observer.lonDeg.toFixed(4)}°, alt=${observer.altM.toFixed(1)} m`,
      `Span=${spanMin} min, step=${stepMin} min`,
      "",
      ...summaries
    ].join("\n");

    ids.status.textContent = `Plotted ${parsed.length} object(s)`;
  } catch (error) {
    ids.status.textContent = "Error";
    ids.out.textContent = `Failed to plot trajectories.\n\n${String(error?.message || error)}`;
  }
}

ids.plot.addEventListener("click", () => {
  void plot();
});

setDefaultStartTime();
seedDefaultTle();
void plot();
