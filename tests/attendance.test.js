import { describe, it, expect } from "vitest";
import { weekDates, currentWeekIndex, isSchoolDay, termSummary, weekSummary, csvCell } from "../src/lib/attendance.js";
const att = (m) => m; // attendance[ds][id] = { morning, afternoon }
describe("attendance rules (unchanged from the attendance app)", () => {
  it("lists Monday to Friday of a term week", () => { expect(weekDates("2026-09-14", 2)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]); });
  it("finds the current week and clamps it", () => {
    expect(currentWeekIndex("2026-09-14", 13, "2026-10-19")).toBe(6);
    expect(currentWeekIndex("2026-09-14", 13, "2027-05-01")).toBe(13);
  });
  it("excludes weekends, holidays and future dates from school days", () => {
    const hol = { "2026-10-01": { label: "Independence Day" } };
    expect(isSchoolDay("2026-10-03", hol, "2026-10-19")).toBe(false);
    expect(isSchoolDay("2026-10-01", hol, "2026-10-19")).toBe(false);
    expect(isSchoolDay("2026-10-20", hol, "2026-10-19")).toBe(false);
    expect(isSchoolDay("2026-10-02", hol, "2026-10-19")).toBe(true);
  });
  const students = [{ id: "a", name: "A", gender: "M" }, { id: "b", name: "B", gender: "F" }];
  const a = att({ "2026-09-14": { a: { morning: true, afternoon: true }, b: { morning: true } }, "2026-09-15": { a: { morning: true, afternoon: true } } });
  it("computes the term summary and flags at-risk students", () => {
    const s = termSummary({ students, attendance: a, holidays: {}, termStart: "2026-09-14", weeks: 13, today: "2026-09-15", atRiskBelow: 75 });
    expect(s.schoolDays).toBe(2); expect(s.maxPts).toBe(4);
    expect(s.rows.map((r) => r.pts)).toEqual([4, 1]);
    expect(s.atRisk).toBe(1);
    expect(s.grandPct).toBeCloseTo(62.5);
  });
  it("computes week percentage as marks / (school days x students x 2)", () => {
    const w = weekSummary({ students, attendance: a, holidays: {}, termStart: "2026-09-14", week: 1, today: "2026-09-15" });
    expect(w.schoolDays).toBe(2); expect(w.actual).toBe(5); expect(w.pct).toBeCloseTo(62.5);
  });
  it("neutralises spreadsheet formulas in CSV cells", () => { expect(csvCell("=1+1")).toBe("'=1+1"); expect(csvCell("+2348012345678")).toBe("+2348012345678"); });
});
