/**
 * Attendance maths, ported unchanged from babatundeawo/attendance (logic.js).
 * Pure functions: no DOM, no Firebase. Covered by tests/attendance.test.js.
 */

export const SESSIONS = { AM: "morning", PM: "afternoon" };

export function pad(n) {
  return String(n).padStart(2, "0");
}

/** Date -> "YYYY-MM-DD" using local time. */
export function dstr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" -> Date at local midnight. */
export function parseD(s) {
  return new Date(`${s}T00:00:00`);
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function todayStr() {
  return dstr(new Date());
}

export function isWeekend(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

/** The five weekday date strings of term week `w` (1-based). */
export function weekDates(termStart, w) {
  const start = addDays(parseD(termStart), (w - 1) * 7);
  return Array.from({ length: 5 }, (_, i) => dstr(addDays(start, i)));
}

/** Which term week contains `today` (clamped to 1..weeks). */
export function currentWeekIndex(termStart, weeks, today) {
  for (let w = 1; w <= weeks; w++) {
    if (today <= weekDates(termStart, w)[4]) return w;
  }
  return weeks;
}

/** A school day is a weekday, not a holiday, and not in the future. */
export function isSchoolDay(ds, holidays, today) {
  if (isWeekend(parseD(ds))) return false;
  if (holidays[ds]) return false;
  if (ds > today) return false;
  return true;
}

export function getStatus(attendance, ds, id, session) {
  return Boolean(attendance[ds]?.[id]?.[session]);
}

export function dayPoints(attendance, ds, id) {
  return (
    (getStatus(attendance, ds, id, SESSIONS.AM) ? 1 : 0) +
    (getStatus(attendance, ds, id, SESSIONS.PM) ? 1 : 0)
  );
}

/** How many of the listed students are marked present for one session. */
export function sessionTally(attendance, students, ds, session) {
  let c = 0;
  for (const st of students) if (getStatus(attendance, ds, st.id, session)) c++;
  return c;
}

export function percent(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

export function initials(name) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0] ? parts[0][0] : "";
  const b = parts[1] ? parts[1][0] : "";
  return (a + b).toUpperCase();
}

export function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function autoParent(name) {
  const first = name.trim().split(/\s+/)[0] || "";
  return first ? `Mr & Mrs ${titleCase(first)}` : "";
}

/** Register order first, then name. Students without an order go last. */
export function sortStudents(students) {
  return students.slice().sort((a, b) => {
    const oa = typeof a.order === "number" ? a.order : 9999;
    const ob = typeof b.order === "number" ? b.order : 9999;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });
}

/** A new, practically unique document id for a student. */
export function newStudentId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function nextOrderFor(students, gender) {
  let max = -1;
  for (const s of students) {
    if (s.gender === gender && typeof s.order === "number" && s.order > max) max = s.order;
  }
  return max + 1;
}

/** Summary of one term week: per-day tallies plus per-student points. */
export function weekSummary({ students, attendance, holidays, termStart, week, today }) {
  const dates = weekDates(termStart, week);
  const days = [];
  let wkM = 0;
  let wkA = 0;
  let schoolDays = 0;
  for (const ds of dates) {
    if (holidays[ds]) {
      days.push({ ds, kind: "holiday", label: holidays[ds].label || "" });
    } else if (ds > today) {
      days.push({ ds, kind: "future" });
    } else {
      const m = sessionTally(attendance, students, ds, SESSIONS.AM);
      const a = sessionTally(attendance, students, ds, SESSIONS.PM);
      wkM += m;
      wkA += a;
      schoolDays++;
      days.push({ ds, kind: "school", m, a });
    }
  }
  const maxPts = schoolDays * 2;
  const actual = wkM + wkA;
  const expected = schoolDays * students.length * 2;
  const sorted = sortStudents(students);
  const groups = { M: [], F: [] };
  for (const st of sorted) {
    if (!groups[st.gender]) continue;
    let pts = 0;
    for (const ds of dates) {
      if (isSchoolDay(ds, holidays, today)) pts += dayPoints(attendance, ds, st.id);
    }
    groups[st.gender].push({ st, pts, pct: Math.round(percent(pts, maxPts)) });
  }
  return { dates, days, wkM, wkA, actual, schoolDays, maxPts, pct: percent(actual, expected), groups };
}

/** Summary of the whole term to date. */
export function termSummary({ students, attendance, holidays, termStart, weeks, today, atRiskBelow }) {
  const schoolDays = [];
  for (let w = 1; w <= weeks; w++) {
    for (const ds of weekDates(termStart, w)) {
      if (isSchoolDay(ds, holidays, today)) schoolDays.push(ds);
    }
  }
  const maxPts = schoolDays.length * 2;
  let grandActual = 0;
  const rows = sortStudents(students).map((st) => {
    let pts = 0;
    for (const ds of schoolDays) pts += dayPoints(attendance, ds, st.id);
    grandActual += pts;
    return { st, pts, pct: percent(pts, maxPts) };
  });
  const grandExpected = maxPts * students.length;
  return {
    schoolDays: schoolDays.length,
    maxPts,
    rows,
    grandActual,
    grandExpected,
    grandPct: percent(grandActual, grandExpected),
    atRisk: rows.filter((r) => r.pct < atRiskBelow).length,
  };
}

/**
 * Make one CSV cell safe. Quotes values that need it and neutralises values a
 * spreadsheet could run as a formula (but leaves plain phone numbers alone).
 */
export function csvCell(value) {
  let v = value === undefined || value === null ? "" : String(value);
  const looksNumeric = /^[+-]?[\d\s()-]+$/.test(v);
  if (/^[=@\t\r]/.test(v) || (/^[+-]/.test(v) && !looksNumeric)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Every school day of a term up to today (weekends, holidays and future dates left out), as YYYY-MM-DD. */
export function schoolDaysUpTo(termStart, weeks, holidays, today) {
  const out = []; for (let i = 0; i < weeks * 7; i++) { const ds = dstr(addDays(parseD(termStart), i)); if (isSchoolDay(ds, holidays, today)) out.push(ds); } return out;
}
