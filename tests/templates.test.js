// @vitest-environment jsdom
import { it, expect, vi, beforeAll } from "vitest";
const bulk = [];
vi.mock("../src/lib/data.js", () => ({ saveRemarks: async () => {}, saveRemarksBulk: async (...a) => { bulk.push(a); } }));
import { CONDUCT_TEMPLATES, DEFAULT_TUTOR_BANDS, DEFAULT_PRINCIPAL_BANDS, bandsFor, commentFor, parseBandLine, bandLine } from "../src/lib/templates.js";
import { AFFECTIVE, PSYCHOMOTOR } from "../src/lib/reportcard.js";
import { applyTemplatesDialog } from "../src/views/reportcard.js";
import { state } from "../src/lib/store.js";

beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function (v) { this.returnValue = v || ""; this.removeAttribute("open"); this.dispatchEvent(new Event("close")); }; });
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));

it("conduct templates rate all fifteen traits between 1 and 5", () => {
  const keys = [...AFFECTIVE, ...PSYCHOMOTOR].map(([k]) => k); expect(keys.length).toBe(15);
  for (const t of CONDUCT_TEMPLATES) { expect(Object.keys(t.ratings).sort()).toEqual([...keys].sort()); expect(Object.values(t.ratings).every((n) => n >= 1 && n <= 5)).toBe(true); }
  expect(CONDUCT_TEMPLATES.find((t) => t.id === "very-good").ratings).toMatchObject({ punctuality: 5, ict: 4, games: 5 });
});
it("comments match the student's total percentage, using the school's own bands when set", () => {
  expect(commentFor(DEFAULT_PRINCIPAL_BANDS, 75)).toBe("An excellent result. Keep it up."); expect(commentFor(DEFAULT_PRINCIPAL_BANDS, 55)).toBe("A good performance"); expect(commentFor(DEFAULT_TUTOR_BANDS, 12)).toContain("below expectation");
  const school = { report: { principalBands: [{ min: 0, text: "Fine" }, { min: 50, text: "Great" }] } };
  expect(bandsFor(school, "principal").map((b) => b.min)).toEqual([50, 0]); expect(commentFor(bandsFor(school, "principal"), 60)).toBe("Great");
  expect(bandsFor({}, "tutor")).toBe(DEFAULT_TUTOR_BANDS); expect(parseBandLine("70 | Well done")).toEqual({ min: 70, text: "Well done" }); expect(parseBandLine("nonsense")).toBeNull(); expect(parseBandLine(bandLine({ min: 5, text: "x" }))).toEqual({ min: 5, text: "x" });
});
function open(role, extra = {}) {
  Object.assign(state, { isOwner: false, profile: { role, name: "Mrs Ade" } });
  const mk = (id, pct, ex) => ({ student: { id, name: id, classKey: "SS1|" }, card: { totals: { percent: pct } }, existing: ex, selected: id === "b" });
  applyTemplatesDialog({ targets: [mk("a", 75), mk("b", 45, { ratings: { punctuality: 2 }, tutorComment: "Kept" }), mk("c", 55)], selectedCount: 1, session: "2025/2026", term: 2, school: {}, loadSchoolWide: null, ...extra });
  return document.querySelector("dialog");
}
const choose = (dlg, id, v) => { const el = dlg.querySelector("#" + id); el.value = v; el.dispatchEvent(new Event("change")); };
const submit = async (dlg) => { dlg.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true })); await wait(); document.querySelector("dialog:last-of-type .btn-primary")?.click(); await wait(); };

it("a class teacher applies a conduct template and matched tutor comments to the whole class, keeping what is already entered", async () => {
  bulk.length = 0; const dlg = open("teacher");
  expect(dlg.querySelector("#ap")).toBeNull();                                  // no principal section for a class teacher
  choose(dlg, "ac", "excellent"); choose(dlg, "at", "match");
  await submit(dlg);
  const items = bulk[0][2]; expect(items.length).toBe(3);
  const by = Object.fromEntries(items.map((i) => [i.student.id, i.patch]));
  expect(by.a.ratings.punctuality).toBe(5); expect(by.a.tutorComment).toContain("excellent student");  // 75% -> top band
  expect(by.b.ratings.punctuality).toBe(2); expect(by.b.ratings.neatness).toBe(5); expect(by.b.tutorComment).toBeUndefined(); // existing kept, empty traits filled
  expect(by.c.tutorComment).toBe("Shows consistent effort and improvement in academic work."); expect(by.c.tutorName).toBe("Mrs Ade");
  expect(Object.keys(by.a)).not.toContain("principalComment");
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});
it("the admin applies principal comments to the ticked students only, and can replace existing ones", async () => {
  bulk.length = 0; const dlg = open("admin"); const who = dlg.querySelector("#aw"); who.value = "selected";
  choose(dlg, "ap", "match"); dlg.querySelectorAll('input[type="checkbox"]')[2].checked = true; // replace principal comments
  await submit(dlg);
  const items = bulk[0][2]; expect(items.map((i) => i.student.id)).toEqual(["b"]); expect(items[0].patch.principalComment).toBe("A fair result. Work harder."); // 45% band
  expect(items[0].patch.tutorComment).toBeUndefined(); document.querySelectorAll("dialog").forEach((d) => d.remove());
});
