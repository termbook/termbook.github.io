import { describe, it, expect } from "vitest";
import { calc, annual, rankOf, grade, ord, parseNames, suggestAttendanceBonus, DEFAULT_WEIGHTS } from "../src/lib/scores.js";
const sheet = (scores, bonus = true) => ({ bonus, students: { a: { n: "A", s: "M" }, b: { n: "B", s: "F" }, c: { n: "C", s: "F" } }, scores });
describe("scoring rules (unchanged from the scoresheet app)", () => {
  it("returns null until something is entered", () => { expect(calc(sheet({}), 1, "a")).toBeNull(); });
  it("adds bonus marks to the exam when the bonus switch is on", () => {
    const c = sheet({ 1: { a: { a: 8, b: 7, c: 9, e: 40, at: 5, tb: 4, nb: 3 } } });
    expect(calc(c, 1, "a")).toEqual({ a: 8, b: 7, c: 9, ex: 52, t: 76 });
  });
  it("ignores bonus marks when the switch is off", () => {
    const c = sheet({ 1: { a: { a: 8, b: 7, c: 9, e: 40, at: 5, tb: 4, nb: 3 } } }, false);
    expect(calc(c, 1, "a").ex).toBe(40);
  });
  it("caps the exam at 70 even with bonus marks", () => {
    const c = sheet({ 1: { a: { a: 10, b: 10, c: 10, e: 68, at: 5, tb: 5, nb: 5 } } });
    expect(calc(c, 1, "a")).toMatchObject({ ex: 70, t: 100 });
  });
  it("honours a different exam weight from school settings", () => {
    const c = sheet({ 1: { a: { e: 55, at: 5 } } });
    expect(calc(c, 1, "a", { ...DEFAULT_WEIGHTS, e: 60 }).ex).toBe(60);
  });
  it("uses default grade boundaries and custom ones", () => {
    expect([100, 70, 69, 60, 50, 45, 40, 39].map((t) => grade(t))).toEqual(["A", "A", "B", "B", "C", "D", "E", "F"]);
    expect(grade(55, [{ min: 50, g: "Pass" }, { min: 0, g: "Fail" }])).toBe("Pass");
  });
  it("ranks with shared positions for ties", () => {
    const c = sheet({ 1: { a: { e: 70 }, b: { e: 60 }, c: { e: 60 } } });
    expect(rankOf(c, 1, "a")).toEqual({ p: 1, n: 3 });
    expect(rankOf(c, 1, "b")).toEqual({ p: 2, n: 3 });
    expect(rankOf(c, 1, "c")).toEqual({ p: 2, n: 3 });
  });
  it("averages only the terms that have scores", () => {
    const c = sheet({ 1: { a: { e: 60 } }, 2: { a: { e: 50 } } });
    expect(annual(c, "a")).toMatchObject({ sum: 110, n: 2, avg: 55 });
  });
  it("formats ordinals and parses pasted names", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ord)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
    expect(parseNames("1. Ade Bola, F\nTunde Ola, M, R\n")).toEqual([{ n: "Ade Bola", s: "F", r: false }, { n: "Tunde Ola", s: "M", r: true }]);
  });
  it("suggests the attendance bonus without applying it", () => {
    expect([100, 90, 50, 0].map(suggestAttendanceBonus)).toEqual([5, 5, 3, 0]);
  });
});
