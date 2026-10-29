/**
 * Progress tracking. Pure functions that turn report card models (one per term) and attendance records
 * into the numbers the charts show. Parents get them from published cards; staff from live score sheets.
 */
import { round1 } from "./reportcard.js";
import { AFFECTIVE, PSYCHOMOTOR } from "./reportcard.js";

export const TERM_LABELS = ["1st term", "2nd term", "3rd term"];
const mean = (a) => { const v = a.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)); return v.length ? round1(v.reduce((p, n) => p + n, 0) / v.length) : null; };
const pctOf = (n, d) => (d ? round1((n / d) * 100) : null);
/** cardsByTerm: { 1: card, 2: card, 3: card } (missing terms are simply absent) */
export const termsWith = (cardsByTerm) => [1, 2, 3].filter((t) => cardsByTerm[t] && cardsByTerm[t].counts?.offered > 0);

/** Overall percentage, class percentage and class position for each term. */
export function overall(cardsByTerm) {
  const pick = (f) => [1, 2, 3].map((t) => { const c = cardsByTerm[t]; return c && c.counts.offered > 0 ? f(c) : null; });
  return { labels: TERM_LABELS, student: pick((c) => c.totals.percent), klass: pick((c) => c.totals.classPercent ?? null), position: pick((c) => c.counts.position), size: pick((c) => c.counts.classSize) };
}
export const subjectNames = (cardsByTerm) => [...new Set([1, 2, 3].flatMap((t) => (cardsByTerm[t]?.rows || []).filter((r) => r.offered).map((r) => r.subject)))];
export function subjectsThisTerm(card) { return (card?.rows || []).filter((r) => r.offered).map((r) => ({ label: r.subject, value: r.total, marker: r.classAvg ?? null, grade: r.grade })).sort((a, b) => b.value - a.value); }
export function subjectTrend(cardsByTerm, subject) {
  const row = (t) => cardsByTerm[t]?.rows?.find((r) => r.subject === subject && r.offered);
  return { labels: TERM_LABELS, total: [1, 2, 3].map((t) => row(t)?.total ?? null), ca: [1, 2, 3].map((t) => row(t)?.ca ?? null), exam: [1, 2, 3].map((t) => row(t)?.exam ?? null), classAvg: [1, 2, 3].map((t) => row(t)?.classAvg ?? null) };
}
/** Conduct score as a percentage of the possible rating, per term. */
export function conductSeries(cardsByTerm) {
  const f = (k) => [1, 2, 3].map((t) => { const b = cardsByTerm[t]?.[k]; return b && b.total ? pctOf(b.obtained, b.total) : null; });
  return { labels: TERM_LABELS, behavioural: f("affective"), psychomotor: f("psychomotor") };
}
export const traitBars = (card) => [...(card?.affective?.items || []), ...(card?.psychomotor?.items || [])].filter((i) => i.rating).map((i) => ({ label: i.label, value: i.rating }));
/** Best and weakest subjects this term, and the change since the earlier term. */
export function highlights(cardsByTerm, term) {
  const cur = subjectsThisTerm(cardsByTerm[term]); const prevTerm = [1, 2, 3].filter((t) => t < term && cardsByTerm[t]?.counts?.offered).pop();
  const prev = prevTerm ? Object.fromEntries(subjectsThisTerm(cardsByTerm[prevTerm]).map((s) => [s.label, s.value])) : {};
  const moves = cur.filter((s) => prev[s.label] !== undefined).map((s) => ({ label: s.label, change: round1(s.value - prev[s.label]) })).sort((a, b) => b.change - a.change);
  return { best: cur.slice(0, 3), weakest: cur.slice(-3).reverse().filter((s) => !cur.slice(0, 3).includes(s) || cur.length <= 3), improved: moves.filter((m) => m.change > 0).slice(0, 3), declined: moves.filter((m) => m.change < 0).reverse().slice(0, 3), prevTerm: prevTerm || null };
}
export function gradeCounts(card) { const m = {}; (card?.rows || []).filter((r) => r.offered).forEach((r) => (m[r.grade] = (m[r.grade] || 0) + 1)); return m; }
export const trend = (values) => { const v = values.filter((x) => x !== null && x !== undefined); if (v.length < 2) return 0; const d = v[v.length - 1] - v[v.length - 2]; return Math.abs(d) < 1 ? 0 : d > 0 ? 1 : -1; };

/**
 * Attendance record: { d: { "2026-09-21": 3 }, od: { 1: ["2026-09-14", ...] } }.
 * d holds the marks present (1 = morning, 2 = afternoon, 3 = both); od lists the school days up to the last update.
 */
const bits = (m) => (m & 1 ? 1 : 0) + (m & 2 ? 1 : 0);
const mondayOf = (ds) => { const d = new Date(`${ds}T00:00:00`); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.toISOString().slice(0, 10); };
export function weeklyAttendance(rec, term) {
  const days = (rec?.od?.[term] || []).slice().sort(); if (!days.length) return { labels: [], values: [], opened: 0, present: 0, pct: null };
  const weeks = [...new Set(days.map(mondayOf))]; const present = (ds) => bits((rec.d || {})[ds] || 0);
  const values = weeks.map((w) => { const dd = days.filter((x) => mondayOf(x) === w); return pctOf(dd.reduce((p, x) => p + present(x), 0), dd.length * 2); });
  const opened = days.length * 2, got = days.reduce((p, x) => p + present(x), 0);
  return { labels: weeks.map((_, i) => `Wk ${i + 1}`), values, opened, present: got, absent: opened - got, pct: pctOf(got, opened) };
}
export const absentDays = (rec, term) => (rec?.od?.[term] || []).filter((ds) => bits((rec.d || {})[ds] || 0) < 2).map((ds) => ({ date: ds, marks: bits((rec.d || {})[ds] || 0) }));

/** Group view for a class (class teacher, admin, owner): cardsByTerm is { term: [card, ...] } for every student. */
export function classStats(cardsByTerm, passAt = 40) {
  const termsList = [1, 2, 3].filter((t) => (cardsByTerm[t] || []).some((c) => c.counts.offered));
  const scored = (t) => (cardsByTerm[t] || []).filter((c) => c.counts.offered);
  const stats = [1, 2, 3].map((t) => { const l = scored(t).map((c) => c.totals.percent); return l.length ? { avg: mean(l), max: Math.max(...l), min: Math.min(...l), n: l.length } : null; });
  const latest = termsList[termsList.length - 1] || null; const cur = latest ? scored(latest) : [];
  const buckets = [["0-39", 0, 39.95], ["40-49", 39.95, 49.95], ["50-59", 49.95, 59.95], ["60-69", 59.95, 69.95], ["70+", 69.95, 101]];
  const histogram = buckets.map(([label, lo, hi]) => ({ label, value: cur.filter((c) => c.totals.percent >= lo && c.totals.percent < hi).length }));
  const subj = {}; cur.forEach((c) => c.rows.filter((r) => r.offered).forEach((r) => { (subj[r.subject] ||= []).push(r.total); }));
  const prevT = termsList.filter((t) => t < latest).pop(); const prevSubj = {}; if (prevT) scored(prevT).forEach((c) => c.rows.filter((r) => r.offered).forEach((r) => { (prevSubj[r.subject] ||= []).push(r.total); }));
  const subjectAverages = Object.entries(subj).map(([label, v]) => ({ label, value: mean(v), marker: prevSubj[label] ? mean(prevSubj[label]) : null })).sort((a, b) => b.value - a.value);
  const grades = {}; cur.forEach((c) => c.rows.filter((r) => r.offered).forEach((r) => (grades[r.grade] = (grades[r.grade] || 0) + 1)));
  const byId = {}; [1, 2, 3].forEach((t) => scored(t).forEach((c) => ((byId[c.studentId] ||= { card: c, pct: [null, null, null] }).pct[t - 1] = c.totals.percent)));
  const students = cur.map((c) => { const p = byId[c.studentId].pct; return { id: c.studentId, name: c.student.name, percent: c.totals.percent, position: c.counts.position, failed: c.counts.failed, pct: p, trend: trend(p), atRisk: c.totals.percent < passAt || c.counts.failed > 0 }; }).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  return { termsList, latest, stats, histogram, subjectAverages, grades, students, atRisk: students.filter((s) => s.atRisk), declining: students.filter((s) => s.trend < 0), size: (cardsByTerm[latest] || []).length };
}

/** Group view for one subject in one class (subject teacher): sheet is the stored score sheet, roster the enrolled students. */
export function subjectGroup(sheetModel, roster, { calc, weights, passAt = 40 }) {
  const per = (t) => roster.map((s) => ({ id: s.id, name: s.name, x: calc(sheetModel, t, s.id, weights) })).filter((r) => r.x);
  const terms = [1, 2, 3].map((t) => { const l = per(t); return l.length ? { n: l.length, avg: mean(l.map((r) => r.x.t)), max: Math.max(...l.map((r) => r.x.t)), min: Math.min(...l.map((r) => r.x.t)), ca: mean(l.map((r) => r.x.a + r.x.b + r.x.c)), exam: mean(l.map((r) => r.x.ex)), pass: pctOf(l.filter((r) => r.x.t >= passAt).length, l.length) } : null; });
  const latest = [3, 2, 1].find((t) => terms[t - 1]) || null; const cur = latest ? per(latest) : [];
  const buckets = [["0-39", 0, 40], ["40-49", 40, 50], ["50-59", 50, 60], ["60-69", 60, 70], ["70+", 70, 101]];
  const histogram = buckets.map(([label, lo, hi]) => ({ label, value: cur.filter((r) => r.x.t >= lo && r.x.t < hi).length }));
  const students = roster.map((s) => { const t = [1, 2, 3].map((k) => calc(sheetModel, k, s.id, weights)?.t ?? null); const last = [...t].reverse().find((v) => v !== null); return { id: s.id, name: s.name, totals: t, latest: last ?? null, trend: trend(t), atRisk: last !== undefined && last !== null && last < passAt }; }).filter((s) => s.latest !== null).sort((a, b) => b.latest - a.latest);
  students.forEach((s, i) => { s.position = 1 + students.filter((o) => o.latest > s.latest).length; void i; });
  return { terms, latest, histogram, students, atRisk: students.filter((s) => s.atRisk), notScored: roster.length - cur.length };
}
export const traitList = () => [...AFFECTIVE, ...PSYCHOMOTOR];
