import { describe, it, expect } from "vitest";
import { buildReports } from "../src/lib/reports.js";
const roster = [{ id: "a", name: "A", gender: "M", classKey: "SS1|A", class: "SS1", arm: "A", admissionNo: "1" }, { id: "b", name: "B", gender: "F", classKey: "SS1|A", class: "SS1", arm: "A", admissionNo: "2" }];
const sheets = [
  { subject: "Maths", classKey: "SS1|A", bonus: true, scores: { 1: { a: { a: 10, b: 10, c: 10, e: 60 }, b: { a: 5, b: 5, c: 5, e: 40 } } } },
  { subject: "English", classKey: "SS1|A", bonus: true, scores: { 1: { a: { e: 50 }, b: { e: 65 } } } },
];
describe("report cards", () => {
  const r = buildReports({ roster, sheets, term: 1 });
  it("combines subjects with grade and subject position", () => {
    const a = r.find((x) => x.studentId === "a");
    expect(a.subjects.map((s) => [s.subject, s.t, s.grade, s.pos])).toEqual([["English", 50, "C", 2], ["Maths", 90, "A", 1]]);
    expect(a.total).toBe(140); expect(a.average).toBe(70);
  });
  it("ranks students overall in the class", () => {
    expect(r.find((x) => x.studentId === "a").position).toBe(1);
    expect(r.find((x) => x.studentId === "b").position).toBe(2);
    expect(r[0].classSize).toBe(2);
  });
  it("leaves unscored students without a position", () => {
    const x = buildReports({ roster, sheets: [], term: 1 });
    expect(x.every((s) => s.position === null && s.average === null)).toBe(true);
  });
});
