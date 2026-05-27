import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { loadLogs, saveLogs } from './supabase';

// ─── Equipment types for weight rounding ─────────────────────────────────────
// barbell: 20kg bar + pairs of plates
// dumbbell: fixed DB rack with specific increments
// machine: cable stacks / smith / machines - round to nearest 2.5

const BARBELL_EXERCISES = ["Back Squat", "Close Grip Bench Press", "Standing Barbell Press", "RDL"];
const DUMBBELL_EXERCISES = ["Incline DB Press", "Lateral Raise", "Hammer Curl", "Wrist Extension", "Reverse Curl", "Chest Fly"];
const DB_SIZES = [5, 6, 7.5, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50];

function roundToLoadable(weight, exName) {
  if (BARBELL_EXERCISES.includes(exName)) {
    const plateIncrement = 2.5;
    const barWeight = 20;
    if (weight <= barWeight) return barWeight;
    const plateWeight = weight - barWeight;
    const rounded = Math.round(plateWeight / plateIncrement) * plateIncrement;
    return barWeight + Math.max(0, rounded);
  }
  if (DUMBBELL_EXERCISES.includes(exName)) {
    return DB_SIZES.reduce((prev, curr) =>
      Math.abs(curr - weight) < Math.abs(prev - weight) ? curr : prev
    );
  }
  return Math.round(weight / 2.5) * 2.5;
}

// Plate sizes available, largest first
const PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATE_COLOURS = {
  25: { bg: "#cc0000", text: "#fff", label: "25" },   // red
  20: "#2255cc",                                         // blue
  15: "#ddaa00",                                         // yellow
  10: "#22aa44",                                         // green
  5:  "#ffffff",                                         // white
  2.5: "#4488dd",                                        // light blue
  1.25: "#aaaaaa",                                       // silver
};

function calcPlates(totalWeight) {
  const barWeight = 20;
  if (totalWeight <= barWeight) return [];
  let remaining = (totalWeight - barWeight) / 2; // per side
  const plates = [];
  for (const size of PLATE_SIZES) {
    while (remaining >= size - 0.001) {
      plates.push(size);
      remaining = Math.round((remaining - size) * 1000) / 1000;
    }
  }
  return plates;
}

function PlateVisualiser({ weight }) {
  if (!weight || weight <= 0) return null;
  const plates = calcPlates(weight);
  if (!plates.length) return null;

  const getColour = (size) => {
    const c = PLATE_COLOURS[size];
    return typeof c === "string" ? { bg: c, text: size >= 15 ? "#fff" : "#111" } : c;
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, overflowX: "auto", paddingBottom: 2 }}>
        {/* Left collar */}
        <div style={{ width: 6, height: 28, background: "#888", borderRadius: 2, flexShrink: 0 }} />
        {/* Bar left */}
        <div style={{ width: 18, height: 6, background: "#aaa", flexShrink: 0 }} />
        {/* Plates left side (innermost first — reversed) */}
        {[...plates].reverse().map((size, i) => {
          const c = getColour(size);
          const h = size >= 20 ? 44 : size >= 10 ? 38 : size >= 5 ? 32 : 26;
          return (
            <div key={i} style={{
              width: size >= 10 ? 18 : 12, height: h,
              background: c.bg, borderRadius: 2,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, fontWeight: 700, color: c.text,
              writingMode: "vertical-rl", flexShrink: 0,
              border: size === 5 || size === 1.25 ? "1px solid #ccc" : "none",
            }}>{size}</div>
          );
        })}
        {/* Bar centre */}
        <div style={{ flex: 1, minWidth: 24, height: 6, background: "#aaa" }} />
        {/* Plates right side */}
        {plates.map((size, i) => {
          const c = getColour(size);
          const h = size >= 20 ? 44 : size >= 10 ? 38 : size >= 5 ? 32 : 26;
          return (
            <div key={i} style={{
              width: size >= 10 ? 18 : 12, height: h,
              background: c.bg, borderRadius: 2,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, fontWeight: 700, color: c.text,
              writingMode: "vertical-rl", flexShrink: 0,
              border: size === 5 || size === 1.25 ? "1px solid #ccc" : "none",
            }}>{size}</div>
          );
        })}
        {/* Bar right */}
        <div style={{ width: 18, height: 6, background: "#aaa", flexShrink: 0 }} />
        {/* Right collar */}
        <div style={{ width: 6, height: 28, background: "#888", borderRadius: 2, flexShrink: 0 }} />
      </div>
      <div style={{ fontSize: 9, color: "#888899", marginTop: 3, letterSpacing: 1 }}>
        {plates.map(p => `${p}`).join(" + ")} each side
      </div>
    </div>
  );
}

// ─── Programme ────────────────────────────────────────────────────────────────

const DAYS = [
  {
    id: "day1", label: "Day 1", title: "Lower Posterior",
    exercises: [
      { name: "Hip Thrust", sets: 3, repMin: 8, repMax: 10, type: "compound" },
      { name: "RDL", sets: 3, repMin: 6, repMax: 10, type: "compound", topSet: true },
      { name: "Hack Squat", sets: 2, repMin: 10, repMax: 12, type: "compound" },
      { name: "Seated Leg Curl", sets: 3, repMin: 15, repMax: 25, type: "accessory" },
      { name: "Standing Calf Raise", sets: 4, repMin: 20, repMax: 30, type: "accessory" },
    ],
  },
  {
    id: "day2", label: "Day 2", title: "Upper — Chest + Back",
    exercises: [
      { name: "Incline DB Press", sets: 3, repMin: 6, repMax: 10, type: "compound", topSet: true },
      { name: "Chest Fly", sets: 3, repMin: 12, repMax: 15, type: "accessory" },
      { name: "Pulldown", sets: 3, repMin: 6, repMax: 10, type: "compound", topSet: true },
      { name: "Row", sets: 3, repMin: 10, repMax: 12, type: "compound" },
      { name: "Lateral Raise", sets: 3, repMin: 15, repMax: 25, type: "shoulder_raise" },
      { name: "Cable Pullover", sets: 3, repMin: 12, repMax: 15, type: "accessory" },
    ],
    warmupNote: "Forearm warm-up — empty bar rotations, arms locked. Forward to failure, then backward to failure. Do before the superset.",
    circuit: {
      label: "Superset — Arms",
      rounds: 3,
      rest: null,
      exercises: [
        { name: "Tricep Pushdown", repMin: 12, repMax: 15, type: "accessory" },
        { name: "Preacher Curl", repMin: 12, repMax: 15, type: "accessory" },
      ],
    },
  },
  {
    id: "day3", label: "Day 3", title: "Lower Quad",
    exercises: [
      { name: "Back Squat", sets: 3, repMin: 6, repMax: 8, type: "compound", topSet: true },
      { name: "Leg Press", sets: 3, repMin: 15, repMax: 20, type: "compound" },
      { name: "Leg Extension", sets: 3, repMin: 12, repMax: 15, type: "accessory" },
      { name: "Leg Curl", sets: 3, repMin: 12, repMax: 15, type: "accessory" },
      { name: "Seated Calf Raise", sets: 4, repMin: 20, repMax: 30, type: "accessory" },
    ],
  },
  {
    id: "day4", label: "Day 4", title: "Shoulders & Arms",
    exercises: [
      { name: "Standing Barbell Press", sets: 3, repMin: 5, repMax: 10, type: "compound", topSet: true },
      { name: "Lateral Raise", sets: 3, repMin: 15, repMax: 25, type: "shoulder_raise" },
      { name: "Close Grip Bench Press", sets: 3, repMin: 6, repMax: 12, type: "compound", topSet: true },
      { name: "Neutral Grip Lat Pulldown", sets: 3, repMin: 10, repMax: 12, type: "compound" },
    ],
    warmupNote: "Wrist Extension — 2 × 20 reps @ 6kg before circuit (elbow prep, not logged)",
    circuit: {
      label: "Arms Circuit",
      rounds: 3,
      rest: "90s",
      exercises: [
        { name: "Reverse Curl", repMin: 15, repMax: 20, type: "accessory" },
        { name: "Rope Tricep Pushdown", repMin: 15, repMax: 20, type: "accessory" },
        { name: "Close Grip Push Up", repMin: 15, repMax: 20, type: "bodyweight", noWeight: true },
      ],
    },
  },
];

// ─── Progression Logic ────────────────────────────────────────────────────────

function weightIncrement(type) {
  return type === "compound" ? 2.5 : 1;
}

function getBestSet(sets) {
  if (!sets) return null;
  const filled = sets.filter(s => parseFloat(s.weight) > 0 || s.reps);
  if (!filled.length) return null;
  return filled.reduce((best, s) => {
    const bw = parseFloat(best.weight) || 0, sw = parseFloat(s.weight) || 0;
    const br = parseInt(best.reps) || 0, sr = parseInt(s.reps) || 0;
    return sw > bw || (sw === bw && sr > br) ? s : best;
  });
}

function shouldProgress(sets, repMax) {
  if (!sets) return false;
  // All sets must be logged before progression fires
  const allLogged = sets.every(s => parseFloat(s.weight) > 0 && parseInt(s.reps) > 0);
  if (!allLogged) return false;
  return sets.filter(s => parseInt(s.reps) >= repMax && parseFloat(s.weight) > 0).length >= 2;
}

// Check if stuck — missed target 2 weeks in a row
function isPlateaued(prevSets, prevPrevSets, repMax) {
  if (!prevSets || !prevPrevSets) return false;
  const missedLastWeek = !shouldProgress(prevSets, repMax) && prevSets.every(s => parseFloat(s.weight) > 0 && parseInt(s.reps) > 0);
  const missedWeekBefore = !shouldProgress(prevPrevSets, repMax) && prevPrevSets.every(s => parseFloat(s.weight) > 0 && parseInt(s.reps) > 0);
  return missedLastWeek && missedWeekBefore;
}

function getDeloadTarget(prevSets, ex) {
  const best = getBestSet(prevSets);
  if (!best || !parseFloat(best.weight)) return null;
  const deloadWeight = roundToLoadable(parseFloat(best.weight) * 0.85, ex.name);
  return { weight: deloadWeight, reps: ex.repMin, progressed: false, progressType: null, deload: true };
}

function getBaseTarget(prevSets, ex, prevPrevSets) {
  if (ex.noProgression) return { weight: ex.fixedWeight, reps: ex.repMin, progressed: false, progressType: null };
  if (!prevSets) return null;
  const best = getBestSet(prevSets);
  if (!best) return null;
  const weight = parseFloat(best.weight) || 0;
  if (!weight && ex.type !== "bodyweight") return null;
  const prevReps = parseInt(best.reps) || ex.repMin;
  const progress = shouldProgress(prevSets, ex.repMax);

  // Check for plateau — 2 weeks missed → suggest deload
  if (isPlateaued(prevSets, prevPrevSets, ex.repMax)) {
    return getDeloadTarget(prevSets, ex);
  }

  if (ex.type === "shoulder_raise") {
    if (progress) {
      const newW = roundToLoadable(weight + 1, ex.name);
      return { weight: newW, reps: ex.repMin, progressed: true, progressType: "weight" };
    }
    const nextReps = Math.min(prevReps + 1, ex.repMax);
    return { weight, reps: nextReps, progressed: nextReps > prevReps, progressType: "reps" };
  }

  if (progress) {
    const newW = roundToLoadable(weight + weightIncrement(ex.type), ex.name);
    return { weight: newW, reps: ex.repMin, progressed: true, progressType: "weight" };
  }
  return {
    weight: weight ? roundToLoadable(weight, ex.name) : 0,
    reps: Math.max(ex.repMin, Math.min(prevReps, ex.repMax)),
    progressed: false,
    progressType: null,
  };
}

// Build targets for every set — top set uses base target, back-off sets use 90% of logged top set
// Straight sets just repeat the same base target throughout
function buildAllSetTargets(currentSets, baseTarget, ex) {
  // Straight sets — same target for every set, no recalculation
  if (!ex.topSet) {
    return currentSets.map(() => baseTarget);
  }

  // Top set + back-offs
  const topSet = currentSets[0];
  const topW = parseFloat(topSet?.weight);
  const topR = parseInt(topSet?.reps);

  let backOffTarget = baseTarget;

  if (topW > 0 && topR > 0) {
    // Top set logged — back-off is 90% of actual top set weight
    const backOffWeight = roundToLoadable(topW * 0.9, ex.name);
    const backOffReps = Math.round((ex.repMin + ex.repMax) / 2);
    backOffTarget = { weight: backOffWeight, reps: backOffReps };
  }

  return currentSets.map((s, si) => {
    if (si === 0) return baseTarget;

    const prev = currentSets[si - 1];
    const prevW = parseFloat(prev?.weight);
    const prevR = parseInt(prev?.reps);

    if (!prevW || !prevR) return backOffTarget;

    // Hit the back-off target — keep same
    if (backOffTarget && prevW >= backOffTarget.weight && prevR >= backOffTarget.reps) {
      return backOffTarget;
    }

    // Missed — recalculate from what they lifted
    const orm = prevW * (1 + prevR / 30);
    const targetReps = Math.round((ex.repMin + ex.repMax) / 2);
    return { weight: roundToLoadable(orm / (1 + targetReps / 30), ex.name), reps: targetReps, recalc: true };
  });
}

// ─── Storage (Supabase) ───────────────────────────────────────────────────────

const getWeekKey = (offset = 0) => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(new Date(now).setDate(diff + offset * 7));
  return `week_${mon.getFullYear()}_${mon.getMonth()}_${mon.getDate()}`;
};

const emptyLog = (exercises) =>
  exercises.map(ex => ({ name: ex.name, sets: Array.from({ length: ex.sets }, () => ({ weight: "", reps: "", notes: "" })) }));

const emptyCircuitLog = (circuit) =>
  Array.from({ length: circuit.rounds }, () =>
    circuit.exercises.map(ex => ({ name: ex.name, weight: ex.fixedWeight ? String(ex.fixedWeight) : "", reps: ex.noProgression ? String(ex.repMin) : "", notes: "" }))
  );

async function storageGet() {
  return await loadLogs();
}
async function storageSet(value) {
  await saveLogs(value);
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg: "#0a0a0c", surface: "#16161c", card: "#1c1c24", border: "#38384a", borderBright: "#7070a0",
  accent: "#d4ff00", accentDim: "#aedd00", accentBg: "#1e2408", accentBorder: "#5a7010",
  text: "#ffffff", textSub: "#d8d8e8", muted: "#aaaabc", dimmed: "#555568",
};

const LG = {
  bg: "#2a2a36", surface: "#ffffff", border: "#d0d0dc", borderStrong: "#a0a0b8",
  headerBg: "#1a1a22",
  label: "#555566", text: "#111122",
  accent: "#5a9e00", accentText: "#3a6e00", accentBg: "#edffd0", accentBorder: "#99cc44",
  topBg: "#fffbe6", topBorder: "#d4aa00", topLabel: "#a07800",
  hit: "#e6ffda", hitBorder: "#66bb22",
  miss: "#fff0f0", missBorder: "#ee4444",
  muted: "#888899", badge: "#5a9e00", repBadge: "#0088bb",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0c; }
  input { background: transparent; border: none; outline: none; font-family: 'DM Mono', monospace; font-size: inherit; width: 100%; }
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
  textarea { font-family: 'DM Mono', monospace; resize: none; outline: none; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0a0a0c; } ::-webkit-scrollbar-thumb { background: #38384a; }
  .btn { cursor: pointer; transition: opacity 0.15s; border: none; background: none; font-family: 'DM Mono', monospace; color: inherit; }
  .btn:hover { opacity: 0.65; }
  .card-tap { transition: all 0.18s ease; cursor: pointer; }
  .card-tap:hover { border-color: #d4ff00 !important; transform: translateY(-2px); }
  .ex-row:hover { border-color: #d4ff00 !important; }
  .ex-row { transition: border-color 0.15s; cursor: pointer; }
`;

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("home");
  const [activeDay, setActiveDay] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [logs, setLogs] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [chartEx, setChartEx] = useState(null);
  const [chartDayId, setChartDayId] = useState(null);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [saveFailed, setSaveFailed] = useState(false); // for split-state circuit/regular error

  useEffect(() => {
    storageGet().then(data => {
      if (data) setLogs(data);
      setLoaded(true);
    });
  }, []);

  const persist = async (newLogs) => {
    setLogs(newLogs);
    setSaveStatus("saving");
    setSaveFailed(false);
    try {
      await storageSet(newLogs);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus("error");
      setSaveFailed(true);
    }
  };

  const weekKey = getWeekKey(weekOffset);
  const prevWeekKey = getWeekKey(weekOffset - 1);
  const prevPrevWeekKey = getWeekKey(weekOffset - 2);
  const weekLabel = weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : `${Math.abs(weekOffset)}w ago`;

  const getLog = dayId => {
    const d = DAYS.find(d => d.id === dayId);
    return logs?.[weekKey]?.[dayId] || emptyLog(d.exercises);
  };
  const getPrevLog = dayId => logs?.[prevWeekKey]?.[dayId] || null;
  const getPrevPrevLog = dayId => logs?.[prevPrevWeekKey]?.[dayId] || null;
  const getCircuitLog = dayId => {
    const d = DAYS.find(d => d.id === dayId);
    if (!d.circuit) return null;
    return logs?.[weekKey]?.[dayId + "_c"] || emptyCircuitLog(d.circuit);
  };
  const getPrevCircuitLog = dayId => {
    const d = DAYS.find(d => d.id === dayId);
    if (!d.circuit) return null;
    return logs?.[prevWeekKey]?.[dayId + "_c"] || null;
  };
  const getPrevPrevCircuitLog = dayId => {
    const d = DAYS.find(d => d.id === dayId);
    if (!d.circuit) return null;
    return logs?.[prevPrevWeekKey]?.[dayId + "_c"] || null;
  };

  const updateSet = (dayId, exIdx, si, field, value) => {
    const cur = getLog(dayId);
    const updated = cur.map((ex, ei) => ei !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, i) => i !== si ? s : { ...s, [field]: value }) });
    persist({ ...logs, [weekKey]: { ...(logs[weekKey] || {}), [dayId]: updated } });
  };

  const updateCircuit = (dayId, round, ei, field, value) => {
    const cur = getCircuitLog(dayId);
    const updated = cur.map((r, ri) => ri !== round ? r : r.map((e, ej) => ej !== ei ? e : { ...e, [field]: value }));
    persist({ ...logs, [weekKey]: { ...(logs[weekKey] || {}), [dayId + "_c"]: updated } });
  };

  const getChartData = (dayId, exName) =>
    Object.keys(logs).map(wk => {
      const ex = logs[wk]?.[dayId]?.find(e => e.name === exName);
      if (!ex) return null;
      const weights = ex.sets.map(s => parseFloat(s.weight)).filter(w => !isNaN(w) && w > 0);
      if (!weights.length) return null;
      const p = wk.split("_");
      return { week: `${p[3]}/${parseInt(p[2]) + 1}`, weight: Math.max(...weights) };
    }).filter(Boolean).sort((a, b) => a.week.localeCompare(b.week));

  if (!loaded) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", color: C.muted, fontSize: 12, letterSpacing: 2 }}>
      LOADING...
    </div>
  );

  // ── HOME ────────────────────────────────────────────────────────────────────
  if (view === "home") return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Mono', monospace", color: C.text }}>
      <style>{css}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "44px 20px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, letterSpacing: 5, color: C.accent, textTransform: "uppercase", marginBottom: 8 }}>Training Log</div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 60, lineHeight: 1, letterSpacing: 3 }}>LIFT<span style={{ color: C.accent }}>.</span></div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <button className="btn" onClick={() => setView("chart")} style={{ width: "100%", padding: "12px 0", marginBottom: 12, background: C.card, border: `1px solid ${C.borderBright}`, color: C.textSub, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", borderRadius: 8 }}>
          Progress Charts
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
          <button className="btn" onClick={() => setView("export")} style={{ padding: "10px 0", background: C.card, border: `1px solid ${C.borderBright}`, color: C.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", borderRadius: 8 }}>Export</button>
          <button className="btn" onClick={() => setView("import")} style={{ padding: "10px 0", background: C.card, border: `1px solid ${C.borderBright}`, color: C.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", borderRadius: 8 }}>Import</button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {DAYS.map(day => {
            const log = logs?.[weekKey]?.[day.id];
            // At least one exercise has at least one set logged
            const started = log?.some(ex => ex.sets.some(s => s.weight || s.reps));
            const done = log?.every(ex => ex.sets.some(s => s.weight || s.reps));
            return (
              <div key={day.id} className="card-tap" onClick={() => { setActiveDay(day.id); setView("log"); }}
                style={{ background: C.card, border: `1px solid ${done ? C.accentDim : started ? "#7070a0" : C.border}`, borderRadius: 12, padding: "20px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 3, color: C.muted, textTransform: "uppercase", marginBottom: 5 }}>{day.label}</div>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 2 }}>{day.title}</div>
                    <div style={{ fontSize: 11, color: C.dimmed, marginTop: 4 }}>{day.exercises.length + (day.circuit ? day.circuit.exercises.length : 0)} exercises</div>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: done ? C.accent : started ? "#3a3a50" : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: done ? "#000" : C.muted, fontWeight: 700 }}>
                    {done ? "✓" : started ? "…" : "→"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── LOG ─────────────────────────────────────────────────────────────────────
  if (view === "log" && activeDay) {
    const day = DAYS.find(d => d.id === activeDay);
    const log = getLog(activeDay);
    const prevLog = getPrevLog(activeDay);
    const prevPrevLog = getPrevPrevLog(activeDay);
    const circuitLog = getCircuitLog(activeDay);
    const prevCircuitLog = getPrevCircuitLog(activeDay);
    const prevPrevCircuitLog = getPrevPrevCircuitLog(activeDay);

    const renderExercise = (ex, realIdx) => {
      const prevEx = prevLog?.find(e => e.name === ex.name);
      const prevPrevEx = prevPrevLog?.find(e => e.name === ex.name);
      const baseTarget = getBaseTarget(prevEx?.sets, ex, prevPrevEx?.sets);
      const currentSets = log[realIdx]?.sets || [];
      const setTargets = buildAllSetTargets(currentSets, baseTarget, ex);
      const bestPrev = prevEx ? getBestSet(prevEx.sets) : null;
      const hasAnyPrevData = !!bestPrev;

      return (
        <div key={ex.name} style={{ marginTop: 24, paddingBottom: 20, borderBottom: `1px solid #44445a` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{ex.name}</div>
                {baseTarget?.progressed && baseTarget.progressType === "weight" && <span style={{ fontSize: 9, background: LG.badge, color: "#fff", padding: "2px 7px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>+{weightIncrement(ex.type)}kg ↑</span>}
                {baseTarget?.progressed && baseTarget.progressType === "reps" && <span style={{ fontSize: 9, background: LG.repBadge, color: "#fff", padding: "2px 7px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>+1 rep ↑</span>}
                {baseTarget?.deload && <span style={{ fontSize: 9, background: "#cc6600", color: "#fff", padding: "2px 7px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>⚠ Deload — 85%</span>}
              </div>
              <div style={{ fontSize: 11, color: "#ddddee" }}>
                {ex.topSet ? "Top set + back-off · " : ""}{ex.repMin}–{ex.repMax} reps
                {ex.type === "shoulder_raise" && <span style={{ color: "#00d4ff" }}> · rep-first</span>}
              </div>
            </div>
            <button className="btn" onClick={() => { setChartEx(ex.name); setChartDayId(activeDay); setView("chart"); }}
              style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "5px 10px", border: `1px solid ${LG.borderStrong}`, color: LG.label, borderRadius: 5, whiteSpace: "nowrap", background: LG.surface }}>Chart</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "26px 90px 80px 1fr", gap: 6, padding: "0 6px", marginBottom: 5 }}>
            <div /><div style={{ fontSize: 11, color: "#fff", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Target</div>
            <div style={{ fontSize: 11, color: "#fff", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Actual</div>
            <div style={{ fontSize: 11, color: "#fff", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Notes</div>
          </div>

          {currentSets.map((s, si) => {
            const isTop = ex.topSet && si === 0;
            const target = setTargets[si];
            const actualW = parseFloat(s.weight), actualR = parseInt(s.reps);
            const logged = s.weight !== "" && s.reps !== "" && !isNaN(actualW) && !isNaN(actualR);
            const missed = logged && target && target.weight > 0 && (actualW < target.weight || actualR < target.reps);
            const hit = logged && target && target.weight > 0 && actualW >= target.weight && actualR >= target.reps;
            return (
              <div key={si} style={{ marginBottom: 7 }}>
                {target?.recalc && <div style={{ fontSize: 9, color: "#00d4ff", letterSpacing: 1, paddingLeft: 30, marginBottom: 3, textTransform: "uppercase", fontWeight: 600 }}>↻ recalculated</div>}
                <div style={{ display: "grid", gridTemplateColumns: "26px 90px 80px 1fr", gap: 6, padding: "10px 6px", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
                  background: hit ? LG.hit : missed ? LG.miss : isTop ? LG.topBg : LG.surface,
                  border: `1.5px solid ${hit ? LG.hitBorder : missed ? LG.missBorder : isTop ? LG.topBorder : LG.border}` }}>
                  <div style={{ fontSize: 12, color: isTop ? LG.topLabel : LG.label, alignSelf: "center", fontWeight: 700, textAlign: "center" }}>{isTop ? "T" : si + 1}</div>
                  <div style={{ alignSelf: "center" }}>
                    {target && target.weight > 0 ? (
                      <>
                        <div style={{ fontSize: 14, color: hit ? LG.accentText : missed ? "#cc2222" : LG.accentText, fontWeight: 700 }}>{target.weight}kg</div>
                        <div style={{ fontSize: 11, color: hit ? LG.accent : missed ? "#ee4444" : LG.accent }}>{target.reps} reps</div>
                        {BARBELL_EXERCISES.includes(ex.name) && si === 0 && <PlateVisualiser weight={target.weight} />}
                      </>
                    ) : target && target.weight === 0 ? (
                      <div style={{ fontSize: 11, color: hit ? LG.accent : missed ? "#ee4444" : LG.accent }}>{target.reps} reps</div>
                    ) : <div style={{ fontSize: 13, color: LG.muted }}>—</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, alignSelf: "center" }}>
                    <input type="number" placeholder="kg" value={s.weight} onChange={e => updateSet(activeDay, realIdx, si, "weight", e.target.value)} style={{ fontSize: 14, fontWeight: 500, color: "#111122" }} />
                    <input type="number" placeholder="reps" value={s.reps} onChange={e => updateSet(activeDay, realIdx, si, "reps", e.target.value)} style={{ fontSize: 14, fontWeight: 500, color: "#111122" }} />
                  </div>
                  <input type="text" placeholder="notes…" value={s.notes} onChange={e => updateSet(activeDay, realIdx, si, "notes", e.target.value)} style={{ fontSize: 11, color: "#444466", alignSelf: "center" }} />
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: 11, color: "#ccccdd", marginTop: 8, paddingLeft: 6 }}>
            {bestPrev ? (
              <>Last week: <span style={{ color: "#fff", fontWeight: 500 }}>{bestPrev.weight}kg × {bestPrev.reps} reps</span>
              {baseTarget?.progressed ? <span style={{ color: C.accent, fontWeight: 600 }}> · progressed ↑</span> : ""}
              {baseTarget?.deload ? <span style={{ color: "#cc6600", fontWeight: 600 }}> · missed 2 weeks — deload suggested</span> : ""}
              </>
            ) : (
              <span style={{ color: "#888899" }}>First session — log to set your baseline</span>
            )}
          </div>
        </div>
      );
    };

    const renderCircuit = () => {
      if (!day.circuit || !circuitLog) return null;
      const { circuit } = day;
      const isSuperset = !circuit.rest;
      return (
        <div style={{ marginTop: 28, paddingBottom: 20 }}>
          {/* Warmup note */}
          {day.warmupNote && (
            <div style={{ background: C.accentBg, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Warm-up</div>
              <div style={{ fontSize: 12, color: "#ddddee" }}>{day.warmupNote}</div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: C.accent }} />
            <div style={{ fontSize: 9, color: "#000", background: C.accent, padding: "4px 12px", borderRadius: 4, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
              {circuit.label}{circuit.rest ? ` · ${circuit.rounds} rounds · ${circuit.rest} rest` : ` · ${circuit.rounds} sets`}
            </div>
            <div style={{ flex: 1, height: 1, background: C.accent }} />
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${circuit.exercises.length}, 1fr)`, gap: 4, marginBottom: 8, padding: "0 2px" }}>
            <div />
            {circuit.exercises.map((ex, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                {ex.name.split(" ").map((w, wi) => <div key={wi} style={{ fontSize: 9, color: "#fff", fontWeight: 700, lineHeight: 1.3 }}>{w}</div>)}
                {ex.noProgression && <div style={{ fontSize: 8, color: "#aaaacc", marginTop: 1 }}>fixed</div>}
                {ex.noWeight && <div style={{ fontSize: 8, color: "#aaaacc", marginTop: 1 }}>bodyweight</div>}
              </div>
            ))}
          </div>

          {/* Target row — updates in real time from current session */}
          <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${circuit.exercises.length}, 1fr)`, gap: 4, marginBottom: 10, padding: "0 2px" }}>
            <div style={{ fontSize: 9, color: "#aaaacc", textTransform: "uppercase", letterSpacing: 1, alignSelf: "center" }}>Target</div>
            {circuit.exercises.map((ex, i) => {
              const prevSets = prevCircuitLog ? prevCircuitLog.map(r => r[i]).filter(e => e && (parseFloat(e.weight) > 0 || e.reps)) : [];
              const prevPrevSets = prevPrevCircuitLog ? prevPrevCircuitLog.map(r => r[i]).filter(e => e && (parseFloat(e.weight) > 0 || e.reps)) : [];
              const mappedPrev = prevSets.map(e => ({ weight: e.weight, reps: e.reps }));
              const mappedPrevPrev = prevPrevSets.map(e => ({ weight: e.weight, reps: e.reps }));
              // Use current session's first logged round if available (real-time like straight sets)
              const firstRoundEntry = circuitLog[0]?.[i];
              const firstW = parseFloat(firstRoundEntry?.weight);
              const firstR = parseInt(firstRoundEntry?.reps);
              let target = getBaseTarget(mappedPrev.length ? mappedPrev : null, ex, mappedPrevPrev.length ? mappedPrevPrev : null);
              return (
                <div key={i} style={{ background: "#1e2208", border: `1px solid ${C.accentBorder}`, borderRadius: 6, padding: "6px 2px", textAlign: "center" }}>
                  {target ? (
                    <>{!ex.noWeight && target.weight > 0 && <div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{target.weight}kg</div>}<div style={{ fontSize: 10, color: C.accentDim }}>{target.reps}r</div></>
                  ) : <div style={{ fontSize: 11, color: "#555" }}>—</div>}
                </div>
              );
            })}
          </div>

          {/* Round rows */}
          {Array.from({ length: circuit.rounds }, (_, round) => (
            <div key={round}>
              <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${circuit.exercises.length}, 1fr)`, gap: 4, marginBottom: 4, padding: "0 2px" }}>
                <div style={{ fontSize: 11, color: "#fff", fontWeight: 700, alignSelf: "center" }}>{isSuperset ? `Set ${round + 1}` : `Round ${round + 1}`}</div>
                {circuit.exercises.map((ex, ei) => {
                  const entry = circuitLog[round]?.[ei] || { weight: "", reps: "" };
                  return (
                    <div key={ei} style={{ background: LG.surface, border: `1.5px solid ${LG.border}`, borderRadius: 6, padding: "6px 2px", textAlign: "center" }}>
                      {ex.noProgression ? (
                        <><div style={{ fontSize: 12, color: LG.label, fontWeight: 600 }}>{ex.fixedWeight}kg</div><div style={{ fontSize: 10, color: LG.muted }}>{ex.repMin}r</div></>
                      ) : ex.noWeight ? (
                        <input type="number" placeholder="reps" value={entry.reps} onChange={e => updateCircuit(activeDay, round, ei, "reps", e.target.value)} style={{ fontSize: 12, fontWeight: 500, textAlign: "center", color: "#111122" }} />
                      ) : (
                        <><input type="number" placeholder="kg" value={entry.weight} onChange={e => updateCircuit(activeDay, round, ei, "weight", e.target.value)} style={{ fontSize: 12, fontWeight: 500, textAlign: "center", color: "#111122", marginBottom: 2 }} /><input type="number" placeholder="reps" value={entry.reps} onChange={e => updateCircuit(activeDay, round, ei, "reps", e.target.value)} style={{ fontSize: 12, fontWeight: 500, textAlign: "center", color: "#111122" }} /></>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "0 2px", marginBottom: 8 }}>
                <input type="text" placeholder={`Round ${round + 1} notes…`} value={circuitLog[round]?.[0]?.notes || ""} onChange={e => updateCircuit(activeDay, round, 0, "notes", e.target.value)}
                  style={{ fontSize: 10, color: "#444466", width: "100%", background: "transparent", borderBottom: "1px solid #44445a", padding: "3px 0" }} />
              </div>
              {round < circuit.rounds - 1 && circuit.rest && <div style={{ textAlign: "center", fontSize: 9, color: "#888899", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>— {circuit.rest} rest —</div>}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div style={{ background: LG.bg, minHeight: "100vh", fontFamily: "'DM Mono', monospace", color: "#ffffff" }}>
        <style>{css}</style>
        <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>
          {/* Header */}
          <div style={{ padding: "20px 20px 14px", borderBottom: `2px solid ${LG.border}`, position: "sticky", top: 0, background: LG.headerBg, zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <button className="btn" onClick={() => setView("home")} style={{ color: "#aaaacc", fontSize: 28, padding: "8px 16px 8px 0", minWidth: 44 }}>←</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: C.accent, textTransform: "uppercase" }}>{day.label}</div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, letterSpacing: 2, lineHeight: 1, color: "#fff" }}>{day.title}</div>
              </div>
              {saveStatus === "saving" && <div style={{ fontSize: 10, color: "#aaaacc", letterSpacing: 1 }}>Saving…</div>}
              {saveStatus === "saved" && <div style={{ fontSize: 10, color: C.accent, letterSpacing: 1, fontWeight: 700 }}>✓ Saved</div>}
              {saveStatus === "error" && <div style={{ fontSize: 10, color: "#ee4444", letterSpacing: 1 }}>Save failed</div>}
            </div>
            {saveFailed && (
              <div style={{ background: "#3a0f0f", border: "1px solid #cc2020", borderRadius: 6, padding: "8px 12px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 11, color: "#ff8080" }}>⚠ Save failed — data stored locally. Tap to retry.</div>
                <button className="btn" onClick={() => persist(logs)} style={{ fontSize: 10, color: "#ff8080", letterSpacing: 1, textTransform: "uppercase", marginLeft: 8 }}>Retry</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn" onClick={() => setWeekOffset(w => w - 1)} style={{ fontSize: 11, padding: "5px 14px", background: "#2a2a38", border: "1px solid #555570", color: "#ccccdd", borderRadius: 6 }}>← Prev</button>
              <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: weekOffset === 0 ? "#000" : "#fff", background: weekOffset === 0 ? C.accent : "#3a3a50", borderRadius: 6, padding: "6px 0", letterSpacing: 1 }}>{weekLabel}</div>
              <button className="btn" onClick={() => setWeekOffset(w => Math.min(0, w + 1))} style={{ fontSize: 11, padding: "5px 14px", background: "#2a2a38", border: "1px solid #555570", color: "#ccccdd", borderRadius: 6 }}>Next →</button>
            </div>
          </div>

          <div style={{ padding: "0 16px" }}>
            {/* Regular exercises */}
            {day.exercises.map((ex, exIdx) => {
              const isSuperset = ex.superset && exIdx > 0 && day.exercises[exIdx - 1]?.superset;
              return (
                <div key={ex.name}>
                  {isSuperset && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginBottom: -8 }}>
                      <div style={{ flex: 1, height: 1, background: C.accent }} />
                      <div style={{ fontSize: 9, color: "#000", background: C.accent, padding: "2px 8px", borderRadius: 4, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Superset</div>
                      <div style={{ flex: 1, height: 1, background: C.accent }} />
                    </div>
                  )}
                  {renderExercise(ex, exIdx)}
                </div>
              );
            })}
            {/* Circuit */}
            {renderCircuit()}
          </div>
        </div>
      </div>
    );
  }

  // ── CHARTS ───────────────────────────────────────────────────────────────────
  if (view === "chart") {
    const allEx = DAYS.flatMap(d => d.exercises.map(e => ({ ...e, dayId: d.id, dayLabel: d.title })));
    const sel = chartEx ? allEx.find(e => e.name === chartEx && e.dayId === chartDayId) : null;
    const chartData = sel ? getChartData(sel.dayId, sel.name) : [];
    return (
      <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Mono', monospace", color: C.text }}>
        <style>{css}</style>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 20px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30 }}>
            <button className="btn" onClick={() => { setView(activeDay ? "log" : "home"); setChartEx(null); }} style={{ color: C.muted, fontSize: 28, padding: "8px 16px 8px 0", minWidth: 44 }}>←</button>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: 2 }}>Progress Charts</div>
          </div>
          {sel ? (
            <div>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>{sel.dayLabel}</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 20 }}>{sel.name}</div>
              {chartData.length < 2 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: C.muted, fontSize: 12 }}>Log at least 2 sessions to see your chart.</div>
              ) : (
                <div style={{ background: C.card, border: `1px solid ${C.borderBright}`, borderRadius: 10, padding: "20px 10px 12px" }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="week" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                      <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.borderBright}`, borderRadius: 6, fontSize: 11 }} labelStyle={{ color: C.muted }} itemStyle={{ color: C.accent }} formatter={v => [`${v}kg`, "Top weight"]} />
                      <Line type="monotone" dataKey="weight" stroke={C.accent} strokeWidth={2.5} dot={{ fill: C.accent, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <button className="btn" onClick={() => setChartEx(null)} style={{ marginTop: 16, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", padding: "7px 14px", border: `1px solid ${C.borderBright}`, color: C.muted, borderRadius: 5 }}>← All exercises</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Pick an exercise to see your progress.</div>
              {DAYS.map(day => (
                <div key={day.id} style={{ marginBottom: 26 }}>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: C.accent, textTransform: "uppercase", marginBottom: 10 }}>{day.label} · {day.title}</div>
                  <div style={{ display: "grid", gap: 7 }}>
                    {day.exercises.map(ex => (
                      <div key={ex.name} className="ex-row" onClick={() => { setChartEx(ex.name); setChartDayId(day.id); }}
                        style={{ padding: "11px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.textSub }}>{ex.name}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── EXPORT ───────────────────────────────────────────────────────────────────
  if (view === "export") {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(logs))));
    return (
      <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Mono', monospace", color: C.text }}>
        <style>{css}</style>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <button className="btn" onClick={() => setView("home")} style={{ color: C.muted, fontSize: 28, padding: "8px 16px 8px 0", minWidth: 44 }}>←</button>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, letterSpacing: 2 }}>Export Data</div>
          </div>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Tap Copy All, then paste into Notes or email it to yourself.
          </p>
          <textarea readOnly value={encoded} onFocus={e => e.target.select()}
            style={{ width: "100%", height: 140, background: C.card, border: `1px solid ${C.borderBright}`, borderRadius: 8, color: C.textSub, fontSize: 11, padding: 12 }} />
          <button className="btn" onClick={() => {
            const ta = document.createElement("textarea");
            ta.value = encoded;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
          }} style={{
            width: "100%", marginTop: 12, padding: "14px 0",
            background: copied ? "#3a6e00" : C.accent,
            color: copied ? "#fff" : "#000",
            fontSize: 12, letterSpacing: 2, textTransform: "uppercase", borderRadius: 8, fontWeight: 700,
          }}>
            {copied ? "✓ Copied!" : "Copy All"}
          </button>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Or tap the box above to select manually.</p>
        </div>
      </div>
    );
  }

  // ── IMPORT ───────────────────────────────────────────────────────────────────
  if (view === "import") {
    const handleImport = async () => {
      try {
        const decoded = decodeURIComponent(escape(atob(importText.trim())));
        const parsed = JSON.parse(decoded);
        await storageSet(parsed);
        setLogs(parsed);
        setImportStatus("success");
      } catch {
        setImportStatus("error");
      }
    };
    return (
      <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Mono', monospace", color: C.text }}>
        <style>{css}</style>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <button className="btn" onClick={() => setView("home")} style={{ color: C.muted, fontSize: 28, padding: "8px 16px 8px 0", minWidth: 44 }}>←</button>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, letterSpacing: 2 }}>Import Data</div>
          </div>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>Paste your export code below and tap Import.</p>
          <textarea value={importText} onChange={e => { setImportText(e.target.value); setImportStatus(null); }} placeholder="Paste export code here..."
            style={{ width: "100%", height: 180, background: C.card, border: `1px solid ${C.borderBright}`, borderRadius: 8, color: C.textSub, fontSize: 11, padding: 12 }} />
          {importStatus === "success" && <p style={{ fontSize: 12, color: C.accent, marginTop: 10 }}>✓ Imported successfully!</p>}
          {importStatus === "error" && <p style={{ fontSize: 12, color: "#ee4444", marginTop: 10 }}>✗ Invalid code — paste the full export.</p>}
          <button className="btn" onClick={handleImport} style={{ width: "100%", marginTop: 16, padding: "12px 0", background: C.accent, color: "#000", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", borderRadius: 8, fontWeight: 700 }}>Import</button>
        </div>
      </div>
    );
  }

  return null;
}
