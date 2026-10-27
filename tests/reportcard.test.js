import { describe, it, expect } from "vitest";
import { buildClassCards, OYO_GRADES, OYO_REPORT, round1, longDate, ratingText } from "../src/lib/reportcard.js";

const SUBJECTS = ["General Mathematics", "English Language", "Agricultural Science", "Animal Husbandry", "Biology", "Chemistry", "Civic Education", "Commerce", "CRS", "Data Processing", "Economics", "Financial Accounting", "Geography", "Government", "Literature in English", "Marketing", "Physics", "Yoruba"];
const school = { id: "s1", name: "Knowledge Base International Schools", address: "Apapa, Moniya, Ibadan", state: "Oyo", structure: { classes: [{ name: "SS1", arms: ["A"] }, { name: "SS2", arms: ["A"] }], subjectsByLevel: { JSS: [], SS: SUBJECTS } }, scoring: { weights: { a: 10, b: 10, c: 10, e: 70, at: 5, tb: 5, nb: 5 }, grades: OYO_GRADES }, report: { ...OYO_REPORT }, branding: { signature: "data:image/png;base64,AAAA" } };
// A continuous-assessment total (out of 30) is split over the three CA boxes.
const split = (ca) => { const a = Math.min(10, ca), b = Math.min(10, Math.max(0, ca - 10)), c = Math.max(0, ca - 20); return { a, b, c }; };
const entry = (ca, exam) => ({ ...split(ca), e: exam });
const sheetOf = (subject, classKey, terms) => ({ subject, classKey, bonus: false, scores: Object.fromEntries(Object.entries(terms).map(([t, v]) => [t, { s1: entry(v[0], v[1]) }])) });
const roster = (cls, arm) => [{ id: "s1", name: "OKERINDE JUMAIN", gender: "F", class: cls, arm, classKey: `${cls}|${arm}`, admissionNo: "KBI-026", dob: "2010-03-01" }];

describe("report card, checked against the school's real cards", () => {
  it("second term (Okerinde Jumain, SSS2): totals, counts and grades match the printed card", () => {
    const data = { "General Mathematics": [17, 31], "English Language": [25, 24], "Animal Husbandry": [18, 44], "Civic Education": [23, 49], Commerce: [25, 36], "Data Processing": [23, 49], Economics: [27, 30], "Financial Accounting": [26, 44], Marketing: [28, 31] };
    const sheets = Object.entries(data).map(([s, v]) => sheetOf(s, "SS2|A", { 2: v }));
    const [c] = buildClassCards({ roster: roster("SS2", "A"), sheets, term: 2, session: "2025/2026", school, nextTermBegins: "2026-04-27", attendance: { s1: { opened: 120, present: 100 } }, today: "2026-03-01",
      remarks: { s1: { ratings: { punctuality: 5, neatness: 5, attentiveness: 4, relationship: 4, politeness: 5, responsiveness: 4, commitment: 4, consistency: 4, crafts: 4, technical: 4, ict: 4, gardening: 4, games: 5, creativity: 4, verbal: 4 } } } });
    expect(c.rows.map((r) => r.subject).slice(0, 3)).toEqual(["General Mathematics", "English Language", "Agricultural Science"]);
    expect(c.rows.length).toBe(18);
    expect(c.counts).toMatchObject({ offered: 9, passed: 9, failed: 0, classSize: 1, position: 1 });
    expect(c.totals).toEqual({ obtainable: 900, obtained: 550, percent: 61.1 });
    const g = Object.fromEntries(c.rows.filter((r) => r.offered).map((r) => [r.subject, [r.total, r.grade, r.remark]]));
    expect(g["General Mathematics"]).toEqual([48, "P", "PASS"]); expect(g["Animal Husbandry"]).toEqual([62, "C", "GOOD"]); expect(g["Civic Education"]).toEqual([72, "A", "DISTINCTION"]); expect(g["Financial Accounting"]).toEqual([70, "A", "DISTINCTION"]);
    expect(c.rows.find((r) => r.subject === "Biology")).toMatchObject({ offered: false, grade: "NA", remark: "NOT APPLICABLE", total: 0 });
    expect(c.attendance).toEqual({ opened: 120, present: 100, absent: 20 });
    expect(c.affective).toMatchObject({ total: 40, obtained: 35 }); expect(c.psychomotor).toMatchObject({ total: 35, obtained: 29 });
    expect(c.student).toMatchObject({ sn: 1, className: "SSS2 A", gender: "FEMALE", classCategory: "", age: 16 });
    expect(c.footer.nextTerm).toBe("Next Term Begins on Monday, 27th April, 2026."); expect(c.header.subheading).toBe("KNOWLEDGE BASE INTERNATIONAL SCHOOLS, APAPA, MONIYA, IBADAN");
  });
  it("psychomotor total counts only the traits that were rated (first term card: 25 of 30)", () => {
    const [c] = buildClassCards({ roster: roster("SS1", "A"), sheets: [], term: 1, session: "2025/2026", school, remarks: { s1: { ratings: { technical: 4, ict: 4, gardening: 4, games: 5, creativity: 4, verbal: 4 } } } });
    expect(c.psychomotor).toMatchObject({ total: 30, obtained: 25 });
  });
  it("third term (Abdullateef Muhammed, SSS1): averages, total obtained and percent match the printed card", () => {
    const t = { "General Mathematics": [[16, 30], [18, 26], [20, 31]], "English Language": [[22, 52], [22, 30], [25, 40]], "Agricultural Science": [[25, 40], [26, 42]], "Animal Husbandry": [[23, 42], [18, 30], [20, 33]], Biology: [[22, 54], [30, 52], [25, 42]], Chemistry: [[23, 27], [20, 22], [20, 24]], "Civic Education": [[26, 49], [28, 40], [24, 40]], "Data Processing": [[20, 43], [30, 51], [27, 44]], Economics: [[25, 60], [24, 40]], Physics: [[17, 61], [34, 60], [20, 40]] };
    // each entry is [3rd term, 2nd term, 1st term] as [CA, exam]; Agric and Economics have no 1st term, as on the card
    const sheets = Object.entries(t).map(([s, v]) => sheetOf(s, "SS1|A", Object.fromEntries(v.map((x, i) => [3 - i, x]))));
    const totals = { "General Mathematics": [46, 44, 51], "English Language": [74, 52, 65], "Agricultural Science": [65, 68, 0], "Animal Husbandry": [65, 48, 53], Biology: [76, 82, 67], Chemistry: [50, 42, 44], "Civic Education": [75, 68, 64], "Data Processing": [63, 81, 71], Economics: [85, 64, 0], Physics: [78, 94, 60] };
    // use the card's printed totals directly by building scores whose CA+exam equal them
    const fix = Object.entries(totals).map(([s, [a3, a2, a1]]) => sheetOf(s, "SS1|A", { 3: [Math.min(30, Math.round(a3 * .3)), a3 - Math.min(30, Math.round(a3 * .3))], 2: [Math.min(30, Math.round(a2 * .3)), a2 - Math.min(30, Math.round(a2 * .3))], ...(a1 ? { 1: [Math.min(30, Math.round(a1 * .3)), a1 - Math.min(30, Math.round(a1 * .3))] } : {}) }));
    void sheets;
    const [c] = buildClassCards({ roster: roster("SS1", "A"), sheets: fix, term: 3, session: "2025/2026", school, attendance: { s1: { opened: 252, present: 240 } } });
    const r = Object.fromEntries(c.rows.filter((x) => x.offered).map((x) => [x.subject, x]));
    expect(r["English Language"]).toMatchObject({ total: 74, t2: 52, t1: 65, avg: 63.7, grade: "C", remark: "GOOD" });
    expect(r["Data Processing"].avg).toBe(71.7); expect(r["Agricultural Science"]).toMatchObject({ t1: 0, avg: 66.5 }); expect(r["Economics"].avg).toBe(74.5);
    expect(r["Chemistry"]).toMatchObject({ avg: 45.3, grade: "P", remark: "PASS" }); expect(r["Physics"]).toMatchObject({ avg: 77.3, grade: "A" });
    expect(c.totals).toEqual({ obtainable: 1000, obtained: 645.3, percent: 64.5 }); expect(c.counts).toMatchObject({ offered: 10, passed: 10, failed: 0 });
    expect(c.attendance).toEqual({ opened: 252, present: 240, absent: 12 });
  });
  it("ranks the class by total obtained and shares positions on ties", () => {
    const r = [1, 2, 3].map((n) => ({ id: "s" + n, name: "STU " + n, gender: "M", class: "SS1", arm: "A", classKey: "SS1|A", admissionNo: "A" + n }));
    const sheet = { subject: "Biology", classKey: "SS1|A", bonus: false, scores: { 1: { s1: entry(20, 50), s2: entry(20, 50), s3: entry(10, 30) } } };
    const cards = buildClassCards({ roster: r, sheets: [sheet], term: 1, session: "x", school });
    expect(cards.map((c) => c.counts.position)).toEqual([1, 1, 3]);
  });
  it("a class with no arm prints as the class only; the section (Science, Arts, Commercial, Technical) is the class category", () => {
    const sch = { ...school, structure: { ...school.structure, departments: ["Science", "Arts", "Commercial", "Technical"], classes: [{ name: "SS2", arms: [] }] } };
    const noArm = { id: "s1", name: "A B", gender: "M", class: "SS2", arm: "", classKey: "SS2|", admissionNo: "1" };
    const [c1] = buildClassCards({ roster: [noArm], sheets: [], term: 1, session: "x", school: sch });
    expect(c1.student).toMatchObject({ className: "SSS2", classCategory: "" });
    const [c2] = buildClassCards({ roster: [{ ...noArm, category: "Technical" }], sheets: [], term: 1, session: "x", school: sch });
    expect(c2.student.classCategory).toBe("Technical");
    const [c3] = buildClassCards({ roster: [{ ...noArm, arm: "Science", classKey: "SS2|Science" }], sheets: [], term: 1, session: "x", school: sch });
    expect(c3.student).toMatchObject({ className: "SSS2 Science", classCategory: "Science" });
  });
  it("class position is the rank by total percentage, so students with different numbers of subjects are compared fairly", () => {
    const r = [1, 2, 3].map((n) => ({ id: "s" + n, name: "STU " + n, gender: "M", class: "SS1", arm: "", classKey: "SS1|", admissionNo: "A" + n }));
    // s1 takes one subject at 70%; s2 takes two subjects at 60% each (higher total marks, lower percentage); s3 ties s1
    const sheets = [{ subject: "Biology", classKey: "SS1|", bonus: false, scores: { 1: { s1: entry(21, 49), s2: entry(18, 42), s3: entry(21, 49) } } }, { subject: "Physics", classKey: "SS1|", bonus: false, scores: { 1: { s2: entry(18, 42) } } }];
    const cards = buildClassCards({ roster: r, sheets, term: 1, session: "x", school });
    expect(cards.map((c) => [c.totals.percent, c.counts.position])).toEqual([[70, 1], [60, 3], [70, 1]]);
  });
  it("helpers: one-decimal rounding (half up), dates and rating text", () => { expect(round1(71.667)).toBe(71.7); expect(round1(63.65)).toBe(63.7); expect(round1(45.33)).toBe(45.3); expect(round1(47)).toBe(47); expect(longDate("2026-09-14")).toBe("Monday, 14th September, 2026"); expect(ratingText(4)).toBe("GOOD(4)"); });
});
