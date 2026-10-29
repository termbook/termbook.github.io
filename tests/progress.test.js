import { describe, it, expect } from "vitest";
import { overall, subjectsThisTerm, subjectTrend, conductSeries, highlights, gradeCounts, trend, weeklyAttendance, absentDays, classStats, subjectGroup, subjectNames } from "../src/lib/progress.js";
import { buildClassCards, OYO_GRADES } from "../src/lib/reportcard.js";
import { calc } from "../src/lib/scores.js";

const school = { id: "s1", name: "S", state: "Oyo", structure: { classes: [{ name: "SS1", arms: [] }], subjectsByLevel: { JSS: [], SS: ["Mathematics", "Biology"] } }, scoring: { weights: { a: 10, b: 10, c: 10, e: 70, at: 5, tb: 5, nb: 5 }, grades: OYO_GRADES }, report: {} };
const roster = ["a", "b", "c"].map((id, i) => ({ id, name: "STU " + id.toUpperCase(), gender: "M", class: "SS1", arm: "", classKey: "SS1|", admissionNo: String(i) }));
const e = (ca, ex) => ({ a: Math.min(10, ca), b: Math.min(10, Math.max(0, ca - 10)), c: Math.max(0, ca - 20), e: ex });
const sheets = [
  { subject: "Mathematics", classKey: "SS1|", bonus: false, scores: { 1: { a: e(20, 40), b: e(15, 30), c: e(10, 20) }, 2: { a: e(24, 50), b: e(15, 35), c: e(12, 18) } } },
  { subject: "Biology", classKey: "SS1|", bonus: false, scores: { 1: { a: e(18, 45), b: e(15, 30) }, 2: { a: e(21, 55), b: e(15, 33) } } },
];
const byTerm = (t) => buildClassCards({ roster, sheets, term: t, session: "x", school });
const cards = { 1: byTerm(1), 2: byTerm(2) }; const A = { 1: cards[1].find((c) => c.studentId === "a"), 2: cards[2].find((c) => c.studentId === "a") };

describe("individual progress", () => {
  it("overall percentage, class percentage and position by term (a missing term is a gap)", () => {
    const o = overall(A); expect(o.student).toEqual([A[1].totals.percent, A[2].totals.percent, null]); expect(o.klass[0]).toBe(A[1].totals.classPercent); expect(o.position).toEqual([1, 1, null]);
    expect(o.student[1]).toBeGreaterThan(o.student[0]);
  });
  it("subjects this term sorted best first, with the class average as the marker", () => {
    const s = subjectsThisTerm(A[2]); expect(s.map((x) => x.label)).toEqual(["Biology", "Mathematics"].sort((p, q) => s.find((x) => x.label === q).value - s.find((x) => x.label === p).value)); expect(s[0].marker).toBeGreaterThan(0);
  });
  it("subject trend over the terms, with class average and CA/exam parts", () => {
    const t = subjectTrend(A, "Mathematics"); expect(t.total).toEqual([A[1].rows.find((r) => r.subject === "Mathematics").total, A[2].rows.find((r) => r.subject === "Mathematics").total, null]); expect(t.ca[0] + t.exam[0]).toBe(t.total[0]); expect(subjectNames(A).sort()).toEqual(["Biology", "Mathematics"]);
  });
  it("highlights the best subjects and the change since the last term", () => {
    const h = highlights(A, 2); expect(h.prevTerm).toBe(1); expect(h.best.length).toBeGreaterThan(0); expect(h.improved.every((m) => m.change > 0)).toBe(true);
  });
  it("counts grades, trend direction and conduct percentages", () => {
    expect(Object.values(gradeCounts(A[2])).reduce((p, n) => p + n, 0)).toBe(2); expect(trend([50, 60])).toBe(1); expect(trend([60, 50])).toBe(-1); expect(trend([50, 50.4])).toBe(0); expect(trend([null, 50])).toBe(0);
    const rated = { ...A[1], affective: { items: [], total: 40, obtained: 30 }, psychomotor: { items: [], total: 35, obtained: 28 } }; expect(conductSeries({ 1: rated }).behavioural[0]).toBe(75);
  });
});
describe("attendance record", () => {
  const rec = { d: { "2026-09-14": 3, "2026-09-15": 1, "2026-09-21": 3 }, od: { 1: ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-21", "2026-09-22"] } };
  it("weekly percentage and term totals from marks present over school days (two marks a day)", () => {
    const w = weeklyAttendance(rec, 1); expect(w.labels).toEqual(["Wk 1", "Wk 2"]); expect(w.values).toEqual([50, 50]); expect(w.opened).toBe(10); expect(w.present).toBe(5); expect(w.absent).toBe(5); expect(w.pct).toBe(50);
    expect(weeklyAttendance({}, 1).pct).toBeNull();
  });
  it("lists the days missed in part or in full", () => { expect(absentDays(rec, 1)).toEqual([{ date: "2026-09-15", marks: 1 }, { date: "2026-09-16", marks: 0 }, { date: "2026-09-22", marks: 0 }]); });
});
describe("group tracking", () => {
  it("class: average, spread, subject averages with last term as the marker, ranking, at-risk and trend", () => {
    const c = classStats({ 1: cards[1], 2: cards[2] }); expect(c.latest).toBe(2); expect(c.stats[0].n).toBe(3); expect(c.stats[2]).toBeNull();
    expect(c.histogram.reduce((p, h) => p + h.value, 0)).toBe(c.size === 3 ? c.students.length : c.students.length); expect(c.subjectAverages.every((s) => s.marker !== undefined)).toBe(true);
    expect(c.students[0].position).toBe(1); expect(c.students.every((s) => s.pct.length === 3)).toBe(true);
  });
  it("subject teacher: averages per term, CA and exam parts, spread and ranking for one subject", () => {
    const sheetModel = { subject: "Mathematics", bonus: false, scores: sheets[0].scores, students: Object.fromEntries(roster.map((s) => [s.id, { n: s.name, s: "M" }])) };
    const g = subjectGroup(sheetModel, roster, { calc, weights: school.scoring.weights }); expect(g.terms[0].n).toBe(3); expect(g.terms[2]).toBeNull(); expect(g.latest).toBe(2);
    expect(g.students[0].position).toBe(1); expect(g.students.map((s) => s.latest)).toEqual([...g.students.map((s) => s.latest)].sort((a, b) => b - a)); expect(g.terms[1].ca + g.terms[1].exam).toBeCloseTo(g.terms[1].avg, 0);
  });
});
