import { describe, it, expect } from "vitest";
import { nextClass, promotionTarget, findDuplicates, filterStudents, parseStudentRows, makeAccessCode, makeAdmissionNo, isEnrolled } from "../src/lib/students.js";
import { validPhone, showDate, parseShown } from "../src/lib/dates.js";
import data from "../public/data/ng-states-lgas.json" with { type: "json" };
const structure = { classes: [{ name: "JSS1", arms: ["A", "B"] }, { name: "JSS2", arms: ["A"] }, { name: "SS3", arms: ["Science"] }] };
describe("students", () => {
  it("promotes to the next class and graduates after SS3", () => {
    expect(nextClass("JSS1")).toBe("JSS2"); expect(nextClass("JSS3")).toBe("SS1"); expect(nextClass("SS3")).toBe("GRADUATED"); expect(nextClass("X")).toBeNull();
  });
  it("keeps the arm when it exists, else uses the first arm", () => {
    expect(promotionTarget({ class: "JSS1", arm: "A" }, structure)).toMatchObject({ class: "JSS2", arm: "A", classKey: "JSS2|A" });
    expect(promotionTarget({ class: "JSS1", arm: "B" }, structure)).toMatchObject({ class: "JSS2", arm: "A" });
    expect(promotionTarget({ class: "SS3", arm: "Science" }, structure)).toEqual({ graduate: true });
  });
  it("finds likely duplicates by admission number or name in the same class", () => {
    const ex = [{ id: "1", name: "ADE BOLA", admissionNo: "2026/1", classKey: "JSS1|A" }];
    expect(findDuplicates(ex, { name: "ade  bola", classKey: "JSS1|A" })).toHaveLength(1);
    expect(findDuplicates(ex, { name: "Other", admissionNo: "2026/1", classKey: "JSS2|A" })).toHaveLength(1);
    expect(findDuplicates(ex, { name: "ade bola", classKey: "JSS1|B" })).toHaveLength(0);
  });
  it("only enrolled students (active, not deleted) appear on registers", () => {
    expect([{ status: "active" }, { status: "left" }, { status: "pending" }, { status: "active", deleted: true }].map(isEnrolled)).toEqual([true, false, false, false]);
  });
  it("filters by status, class, search and deleted", () => {
    const l = [{ name: "A B", class: "JSS1", status: "active" }, { name: "C D", class: "JSS2", status: "left" }, { name: "E F", class: "JSS1", status: "active", deleted: true }];
    expect(filterStudents(l, { status: "active" })).toHaveLength(1);
    expect(filterStudents(l, { status: "all" })).toHaveLength(2);
    expect(filterStudents(l, { showDeleted: true, status: "all" })).toHaveLength(1);
    expect(filterStudents(l, { q: "c d", status: "all" })).toHaveLength(1);
  });
  it("parses pasted lists and CSV", () => {
    expect(parseStudentRows("Name,Gender\nade bola,F,2026/9\n2. tunde ola, m, r")).toEqual([
      { name: "ADE BOLA", gender: "F", admissionNo: "2026/9", repeater: false }, { name: "TUNDE OLA", gender: "M", admissionNo: "", repeater: true }]);
  });
  it("makes unambiguous access codes and unique admission numbers", () => {
    const c = makeAccessCode(); expect(c).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    expect(makeAdmissionNo(new Set(), 2026)).toMatch(/^2026\/\d{5}$/);
  });
  it("validates Nigerian phones and formats dates as DD/MM/YYYY", () => {
    expect(["08031234567", "+2348031234567", "0803 123 4567"].every(validPhone)).toBe(true);
    expect(["12345", "0603123456", "+2349"].some(validPhone)).toBe(false);
    expect(showDate("2026-10-19")).toBe("19/10/2026"); expect(parseShown("5/3/2026")).toBe("2026-03-05");
  });
  it("ships all 36 states, the FCT and 774 local governments", () => {
    expect(data.states).toHaveLength(37);
    expect(data.states.reduce((n, s) => n + s.lgas.length, 0)).toBe(774);
  });
});
