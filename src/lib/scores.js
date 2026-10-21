/**
 * Score maths, ported from babatundeawo/scoresheet (logic.js) with two changes:
 * the weights and grade boundaries are now read from the school's settings instead of being fixed,
 * and the hard-coded student seed lists are gone. With the default settings every result is identical.
 * Score keys: a = 1st CA, b = 2nd CA, c = open day, e = exam, at = attendance, tb = textbook, nb = notebook.
 */
export const DEFAULT_WEIGHTS = { a: 10, b: 10, c: 10, e: 70, at: 5, tb: 5, nb: 5 };
export const DEFAULT_GRADES = [
  { min: 70, g: "A" }, { min: 60, g: "B" }, { min: 50, g: "C" }, { min: 45, g: "D" }, { min: 40, g: "E" }, { min: 0, g: "F" },
];
export const LBL = { 1: "1st term", 2: "2nd term", 3: "3rd term" };
export const num = (v) => (v === undefined || v === null || v === "") ? 0 : +v;

/** One student's scores for one term. Bonus goes into the exam only when c.bonus is on; the exam is capped at its weight. */
export function calc(c, term, sid, w = DEFAULT_WEIGHTS) {
  const r = (c.scores?.[term] || {})[sid];
  if (!r || !["a", "b", "c", "e"].some((k) => r[k] !== undefined)) return null;
  const bonus = c.bonus ? num(r.at) + num(r.tb) + num(r.nb) : 0;
  const ex = Math.min(w.e, num(r.e) + bonus);
  return { a: num(r.a), b: num(r.b), c: num(r.c), ex, t: num(r.a) + num(r.b) + num(r.c) + ex };
}
export const students = (c) => Object.entries(c.students || {}).map(([id, s]) => ({ id, ...s }))
  .sort((x, y) => x.n.localeCompare(y.n, undefined, { sensitivity: "base" }));
export const groups = (c) => {
  const l = students(c);
  return [["Male", l.filter((s) => s.s === "M")], ["Female", l.filter((s) => s.s === "F")], ["Sex not set", l.filter((s) => !s.s)]].filter((g) => g[1].length);
};
export function annual(c, sid, w) {
  let sum = 0, n = 0; const t = {};
  for (const k of ["1", "2", "3"]) { const x = calc(c, k, sid, w); t[k] = x; if (x) { sum += x.t; n++; } }
  return { t, sum, n, avg: n ? Math.round(sum / n * 10) / 10 : null };
}
export function rankOf(c, term, sid, w) {
  const x = calc(c, term, sid, w); if (!x) return null;
  let p = 1, n = 0;
  for (const s of students(c)) { const y = calc(c, term, s.id, w); if (y) { n++; if (y.t > x.t) p++; } }
  return { p, n };
}
export function termStats(c, term, w) {
  const l = students(c).map((s) => calc(c, term, s.id, w)).filter(Boolean);
  return { scored: l.length, total: Object.keys(c.students || {}).length, avg: l.length ? Math.round(l.reduce((a, x) => a + x.t, 0) / l.length * 10) / 10 : null };
}
export const ord = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || "th");

/** Grade from a total, using the school's boundaries (highest first). */
export const grade = (t, bounds = DEFAULT_GRADES) => (bounds.find((b) => t >= b.min) || bounds[bounds.length - 1]).g;

/** Rows for the Excel file, laid out like the paper scoresheet. */
export function sheetRows(c, w) {
  const W = 23, rows = [], merges = [], blank = () => Array(W).fill("");
  rows.push(["SUBJECT:", c.subject], ["CLASS:", c.cls], ["TEACHER:", c.teacher], ["TERM:", "1st, 2nd & 3rd terms"], []);
  const g = blank(); ["1ST TERM", "2ND TERM", "3RD TERM"].forEach((t, i) => { g[2 + i * 6] = t; merges.push({ s: { r: 5, c: 2 + i * 6 }, e: { r: 5, c: 7 + i * 6 } }); });
  rows.push(g);
  const cols = ["1ST TEST", "2ND TEST", "3RD TEST", "CLASS EXERCISE", "EXAM", "TOTAL"];
  rows.push(["S/N", "NAMES", ...cols, ...cols, ...cols, "Annual", "Total Score", "WEIGHTED AVERAGE"]);
  for (const [label, list] of groups(c)) {
    const l = blank(); l[1] = label.toUpperCase(); rows.push(l);
    list.forEach((s, i) => {
      const r = blank(); r[0] = i + 1; r[1] = s.n + (s.r ? " (Repeater)" : "");
      const an = annual(c, s.id, w);
      ["1", "2", "3"].forEach((t, k) => { const x = an.t[t]; if (!x) return; const o = 2 + k * 6; r[o] = x.a; r[o + 1] = x.b; r[o + 3] = x.c; r[o + 4] = x.ex; r[o + 5] = x.t; });
      if (an.n) { r[20] = an.sum; r[21] = an.sum; r[22] = an.avg; }
      rows.push(r);
    });
  }
  return { rows, merges };
}

/** Turns pasted text into students. Line format: "Name", or "Name, F", or "Name, M, R" (R = repeater). */
export function parseNames(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const p = line.split(",").map((x) => x.trim()).filter(Boolean);
    const n = (p[0] || "").replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ");
    if (!n) continue;
    let s = "", r = false;
    for (const f of p.slice(1).map((x) => x.toLowerCase())) {
      if (f === "m" || f === "male") s = "M"; else if (f === "f" || f === "female") s = "F"; else if (f === "r" || f === "repeater") r = true;
    }
    out.push({ n, s, r });
  }
  return out;
}

/**
 * Suggestion only (never applied automatically): the Attendance /5 bonus from a term attendance percentage.
 * The scoresheet app has no automatic rule for this, so this is a simple proportional suggestion: round(pct / 100 * 5).
 */
export const suggestAttendanceBonus = (pct) => Math.max(0, Math.min(5, Math.round((pct / 100) * 5)));
