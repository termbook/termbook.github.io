// @vitest-environment jsdom
import { it, expect, vi } from "vitest";

const roster = ["a", "b", "c"].map((id, i) => ({ id, name: "STU " + id.toUpperCase(), gender: i === 1 ? "F" : "M", class: "SS1", arm: "", classKey: "SS1|", admissionNo: String(i), status: "active" }));
const e = (ca, ex) => ({ a: Math.min(10, ca), b: Math.min(10, Math.max(0, ca - 10)), c: Math.max(0, ca - 20), e: ex });
const sheets = [
  { subject: "Mathematics", classKey: "SS1|", session: "2026/2027", bonus: false, scores: { 1: { a: e(20, 40), b: e(15, 30), c: e(10, 20) }, 2: { a: e(24, 50), b: e(15, 35), c: e(12, 18) } } },
  { subject: "Biology", classKey: "SS1|", session: "2026/2027", bonus: false, scores: { 1: { a: e(18, 45), b: e(15, 30) }, 2: { a: e(21, 55), b: e(15, 33) } } },
];
vi.mock("../src/lib/data.js", () => ({
  watchStudents: (cb) => { cb(roster); return () => {}; }, studentsOnce: async () => roster, listSheets: async () => sheets, loadSheet: async (s, subject) => sheets.find((x) => x.subject === subject), loadRemarks: async () => ({}),
  loadTerm: async () => null, exportCollection: async () => [], loadStudentAttendance: async () => ({ d: { "2026-09-14": 3, "2026-09-15": 1 }, od: { 2: ["2026-09-14", "2026-09-15", "2026-09-16"] } }),
}));
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const state0 = async (role, profile) => {
  const { state } = await import("../src/lib/store.js"); const { DEFAULT_WEIGHTS } = await import("../src/lib/scores.js"); const { OYO_GRADES } = await import("../src/lib/reportcard.js");
  Object.assign(state, { isOwner: false, profile: { role, ...profile }, school: { id: "s1", name: "T", state: "Oyo", current: { session: "2026/2027", term: 2 }, structure: { classes: [{ name: "SS1", arms: [] }], subjectsByLevel: { JSS: [], SS: ["Mathematics", "Biology"] } }, scoring: { weights: DEFAULT_WEIGHTS, grades: OYO_GRADES }, report: {} } });
  sessionStorage.clear(); localStorage.clear();
};

it("a class teacher sees the class as a group (averages, spread, subjects, ranking) and can open one student's charts", async () => {
  await state0("teacher", { classTeacherKey: "SS1|", assignmentsList: [] });
  const { progressView } = await import("../src/views/progress.js"); const host = document.createElement("div"); document.body.append(host); await progressView(host); await tick(60);
  expect(host.textContent).toContain("My class: SS1"); expect(host.querySelectorAll(".chart").length).toBeGreaterThanOrEqual(4);
  expect(host.textContent).toContain("Class percentage by term"); expect(host.textContent).toContain("Subject averages"); expect(host.querySelectorAll(".stack-table tbody tr").length).toBe(3);
  [...host.querySelectorAll(".stack-table tbody button")][0].click(); await tick(60);
  expect(host.textContent).toContain("Overall percentage by term"); expect(host.textContent).toContain("Class position by term"); expect(host.textContent).toContain("Attendance by week"); expect(host.textContent).toContain("Strongest subjects");
  [...host.querySelectorAll("button")].find((b) => b.textContent.includes("Back")).click(); await tick(60); expect(host.querySelectorAll(".stack-table tbody tr").length).toBe(3);
});
it("a subject teacher sees only their subject: group charts, then one student against the class, with no other subjects or attendance", async () => {
  await state0("teacher", { classTeacherKey: null, assignmentsList: [{ subject: "Mathematics", class: "SS1", arm: "" }] });
  const { progressView } = await import("../src/views/progress.js"); const host = document.createElement("div"); document.body.append(host); await progressView(host); await tick(60);
  expect(host.textContent).toContain("Mathematics, SS1"); expect(host.textContent).not.toContain("Biology"); expect(host.textContent).toContain("class average by term"); expect(host.textContent).toContain("Passed (40+)");
  [...host.querySelectorAll(".stack-table tbody button")][0].click(); await tick(60);
  expect(host.textContent).toContain("against the class"); expect(host.textContent).toContain("Continuous assessment and exam"); expect(host.textContent).not.toContain("Attendance"); expect(host.textContent).not.toContain("Conduct");
});
it("the admin chooses any class and can switch to one subject; jumping in from a student opens that student directly", async () => {
  await state0("admin", {});
  const { progressView, goToProgress } = await import("../src/views/progress.js"); const host = document.createElement("div"); document.body.append(host); await progressView(host); await tick(60);
  expect(host.textContent).toContain("SS1: whole class"); const subj = host.querySelector('select[aria-label="Subject"]'); expect([...subj.options].map((o) => o.textContent)).toEqual(["All subjects (class overview)", "Mathematics", "Biology"]);
  subj.value = "Biology"; subj.dispatchEvent(new Event("change")); await tick(60); expect(host.textContent).toContain("Biology: class average by term");
  goToProgress({ studentId: "b", mode: "class", key: "SS1|" }); expect(JSON.parse(sessionStorage.getItem("tb-progress")).studentId).toBe("b");
  const host2 = document.createElement("div"); document.body.append(host2); await progressView(host2); await tick(80); expect(host2.textContent).toContain("Overall percentage by term"); expect(host2.textContent).toContain("STU B");
});
