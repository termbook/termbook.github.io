// @vitest-environment jsdom
import { it, expect, vi, beforeAll } from "vitest";
import { buildClassCards, OYO_GRADES } from "../src/lib/reportcard.js";
import { DEFAULT_WEIGHTS } from "../src/lib/scores.js";

const school = { id: "s1", name: "KBI", state: "Oyo", structure: { classes: [{ name: "SS1", arms: [] }], subjectsByLevel: { JSS: [], SS: ["Mathematics", "Biology"] } }, scoring: { weights: DEFAULT_WEIGHTS, grades: OYO_GRADES }, report: {} };
const stu = [{ id: "k1", name: "ADE KID", gender: "F", class: "SS1", arm: "", classKey: "SS1|", admissionNo: "K1" }, { id: "k2", name: "OTHER KID", gender: "M", class: "SS1", arm: "", classKey: "SS1|", admissionNo: "K2" }];
const e = (ca, ex) => ({ a: Math.min(10, ca), b: Math.min(10, Math.max(0, ca - 10)), c: Math.max(0, ca - 20), e: ex });
const sheets = [{ subject: "Mathematics", classKey: "SS1|", bonus: false, scores: { 1: { k1: e(20, 40), k2: e(15, 30) }, 2: { k1: e(24, 50), k2: e(18, 30) } } }];
const cardOf = (t) => buildClassCards({ roster: stu, sheets, term: t, session: "2025/2026", school })[0];
const calls = { saved: [], notes: [], linked: [] };
const yr = new Date().getFullYear();
vi.mock("../src/lib/data.js", () => ({
  publicSchools: async () => [{ id: "s1", name: "KBI", state: "Oyo", lga: "Ibadan North" }], linkChild: async (a) => { calls.linked.push(a); return [{ schoolId: "s1", studentId: "k1", admissionNo: "K1" }, { schoolId: "s2", studentId: "z9", admissionNo: "Z9" }, { schoolId: "s1", studentId: "k2", admissionNo: "K2" }]; },
  myChild: async (sid, l) => ({ id: l.studentId, name: l.studentId === "k1" ? "ADE KID" : l.studentId === "k2" ? "OTHER KID" : "LAGOS KID", class: "SS1", arm: "", admissionNo: l.admissionNo, classKey: "SS1|" }),
  reportsForStudent: async (sid, id) => (id === "z9" ? [] : [1, 2].map((t) => ({ term: t, session: "2025/2026", card: cardOf(t) }))), termId: (s, t) => `${s}_${t}`, currentSessionLabel: () => `${yr}/${yr + 1}`,
  publicSchoolBranding: async (id) => ({ name: id === "s1" ? "KBI" : "Lagos School", logo: "", stateLogo: "" }), loadStudentAttendance: async () => ({ d: { "2026-09-14": 3 }, od: { 1: ["2026-09-14", "2026-09-15"] } }),
  saveAbsenceNote: async (...a) => { calls.notes.push(a); }, loadMyAbsenceNotes: async () => [], deleteAbsenceNote: async () => {}, loadPrivateFor: async () => ({ allergies: "Peanuts", stateOfOrigin: "Oyo" }),
  saveParentPrivate: async (...a) => { calls.saved.push(a); },
}));
vi.mock("../src/views/common.js", async (orig) => ({ ...(await orig()), loadNg: async () => [{ name: "Oyo", lgas: ["Ibadan North", "Ibadan South-West"] }, { name: "Lagos", lgas: ["Ikeja"] }] }));
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); }; });
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const click = (host, text) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text)).click();

it("one parent account holds several children, at one school or more, and can link another at any time", async () => {
  const { state } = await import("../src/lib/store.js"); const { parentView } = await import("../src/views/parent.js");
  Object.assign(state, { isOwner: false, profile: { role: "parent", links: [{ schoolId: "s1", studentId: "k1", admissionNo: "K1" }, { schoolId: "s2", studentId: "z9", admissionNo: "Z9" }] } });
  const host = document.createElement("div"); document.body.append(host); await parentView(host); await tick(80);
  const chips = [...host.querySelectorAll(".chips button")]; expect(chips.map((c) => c.textContent)).toEqual(["ADE KIDKBI", "LAGOS KIDLagos School"]);   // two schools: the school is shown under each name
  expect(host.textContent).toContain("Link another child"); expect(host.textContent).toContain("Overall percentage by term"); expect(host.textContent).toContain("Strongest subjects");
  click(host, "Link another child"); await tick(80);
  const dlg = document.querySelector("dialog"); expect(dlg.textContent).toContain("as many children as you have");
  const set = (id, v) => { const el = dlg.querySelector("#" + id); el.value = v; el.dispatchEvent(new Event("change")); };
  const states = dlg.querySelectorAll("select"); states[0].value = "Oyo"; states[0].dispatchEvent(new Event("change")); states[1].value = "Ibadan North"; states[1].dispatchEvent(new Event("change")); states[2].value = "s1"; set("ad", "K2"); set("cd", "abcd2345ef");
  dlg.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true })); await tick(120);
  expect(calls.linked[0]).toEqual({ schoolId: "s1", admissionNo: "K2", code: "ABCD2345EF" }); expect([...host.querySelectorAll(".chips button")].length).toBe(3);   // the new child appears next to the others
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});
it("a parent sees their child's report cards, edits the family, health and emergency details, and tells the teacher about an absence", async () => {
  const { state } = await import("../src/lib/store.js"); const { parentView } = await import("../src/views/parent.js");
  Object.assign(state, { isOwner: false, profile: { role: "parent", links: [{ schoolId: "s1", studentId: "k1", admissionNo: "K1" }] } });
  const host = document.createElement("div"); document.body.append(host); await parentView(host); await tick(80);
  expect(host.querySelectorAll(".chips button").length).toBe(1);
  click(host, "Report cards"); await tick(80); expect(host.querySelectorAll(".rc").length).toBe(2); expect(host.textContent).toContain("Print / save as PDF");
  click(host, "Attendance"); await tick(80); expect(host.textContent).toContain("Attendance by week"); expect(host.textContent).toContain("Tell the teacher about an absence");
  const note = host.querySelector("#ar"); note.value = "Malaria"; const d = host.querySelector("#an"); d.value = "2026-09-15";
  host.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true })); await tick(60); expect(calls.notes[0][1].id).toBe("k1"); expect(calls.notes[0].slice(2)).toEqual(["2026-09-15", "Malaria"]);
  click(host, "Details"); await tick(120);
  expect(host.querySelector("#p_allergies").value).toBe("Peanuts"); expect(host.textContent).not.toContain("Admission date");        // identity and school fields are not editable here
  host.querySelector("#p_phone").value = "123"; host.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true })); await tick(40); expect(calls.saved.length).toBe(0); expect(host.textContent).toContain("valid Nigerian phone");
  host.querySelector("#p_phone").value = "0803 123 4567"; host.querySelector("#p_emergencyName").value = "Aunt Ade"; host.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true })); await tick(60);
  const [sid, id, values] = calls.saved[0]; expect([sid, id]).toEqual(["s1", "k1"]); expect(values).toMatchObject({ phone: "08031234567", emergencyName: "Aunt Ade", allergies: "Peanuts" }); expect(Object.keys(values)).not.toContain("parentName"); expect(Object.keys(values)).not.toContain("admissionDate");
});
