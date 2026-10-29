// @vitest-environment jsdom
import { it, expect, vi, beforeAll } from "vitest";

const saved = [];
const roster = [
  { id: "a", name: "ADE BOLA", gender: "M", classKey: "SS2|A", status: "active" }, { id: "b", name: "BELLO AMINAT", gender: "F", classKey: "SS2|A", status: "active" },
  { id: "c", name: "CHUKWU OBI", gender: "M", classKey: "SS2|A", status: "active" }, { id: "d", name: "DADA JOY", gender: "F", classKey: "JSS3|A", status: "active" },
];
vi.mock("../src/lib/data.js", () => ({
  watchStudents: (cb) => { cb(roster); return () => {}; }, loadSheet: async () => null, saveSheetFlag: async () => {}, sheetId: () => "x",
  saveCell: async (...args) => { saved.push(args); },
}));
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); }; });
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const type = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };

it("choose a class, then a subject of that class; tap a student to open the entry sheet; totals, grades and ranking update live", async () => {
  const { state } = await import("../src/lib/store.js"); const { scoresView } = await import("../src/views/scores.js");
  const { DEFAULT_WEIGHTS, DEFAULT_GRADES } = await import("../src/lib/scores.js");
  Object.assign(state, { isOwner: false, profile: { role: "teacher", name: "T", assignmentsList: [{ subject: "Mathematics", class: "SS2", arm: "A" }, { subject: "Biology", class: "SS2", arm: "A" }, { subject: "Basic Science", class: "JSS3", arm: "A" }] },
    school: { name: "Test School", current: { session: "2026/2027", term: 1 }, structure: { classes: [{ name: "SS2", arms: ["A"] }, { name: "JSS3", arms: ["A"] }] }, scoring: { weights: DEFAULT_WEIGHTS, grades: DEFAULT_GRADES } } });
  const host = document.createElement("div"); document.body.append(host); await scoresView(host); await tick();
  // the two-step selector: classes first, then only the subjects of that class
  const cls = host.querySelector("#sc_class"), subj = host.querySelector("#sc_subject");
  expect([...cls.options].map((o) => o.textContent)).toEqual(["SS2A", "JSS3A"]);
  expect([...subj.options].map((o) => o.textContent)).toEqual(["Mathematics", "Biology"]);
  cls.value = "JSS3|A"; cls.dispatchEvent(new Event("change")); await tick(); expect([...host.querySelector("#sc_subject").options].map((o) => o.textContent)).toEqual(["Basic Science"]);
  expect(host.querySelectorAll(".srow2").length).toBe(1);
  cls.value = "SS2|A"; cls.dispatchEvent(new Event("change")); await tick();
  const rows = host.querySelectorAll(".srow2"); expect(rows.length).toBe(3);
  expect(host.querySelector("input[data-k]")).toBeNull();                         // no score boxes are shown until a student is opened
  expect(rows[0].textContent).toContain("Tap to enter scores");
  rows[0].click(); const dlg = document.querySelector("dialog.sheet-dlg"); expect(dlg.hasAttribute("open")).toBe(true); expect(dlg.textContent).toContain("ADE BOLA");
  const inp = (k) => dlg.querySelector(`input[data-k="${k}"]`);
  type(inp("a"), "15"); expect(inp("a").value).toBe("10");                       // clamped to the maximum
  type(inp("b"), "8"); type(inp("c"), "9"); type(inp("e"), "60"); type(inp("at"), "5"); type(inp("tb"), "5");
  expect(dlg.querySelector(".live strong").textContent).toBe("97");              // 10 + 8 + 9 + exam capped at 70
  expect(rows[0].querySelector(".tot").textContent).toBe("97"); expect(rows[0].querySelector(".gchip").textContent).toBe("A"); expect(rows[0].textContent).toContain("All scores entered");
  expect(host.querySelector(".kpis").textContent).toContain("1 / 3");
  [...dlg.querySelectorAll("button")].find((b) => b.textContent.includes("Next")).click(); await tick();      // opens the next student
  const dlg2 = document.querySelector("dialog.sheet-dlg"); expect(dlg2.textContent).toContain("CHUKWU OBI");   // the list shows males first, then females
  type(dlg2.querySelector('input[data-k="e"]'), "50"); expect(rows[1].textContent).toContain("1 of 4 entered");
  [...dlg2.querySelectorAll("button")].find((b) => b.textContent === "Done").click(); await tick(700);
  expect(document.querySelector("dialog.sheet-dlg")).toBeNull(); expect(saved.length).toBeGreaterThan(6);       // saved without pressing anything
  host.querySelectorAll(".subtabs button")[1].click(); await tick();
  const trs = [...host.querySelectorAll(".results tbody tr")]; expect(trs[0].querySelector("th").textContent).toBe("ADE BOLA"); expect(trs[0].querySelector(".posc").textContent).toContain("🥇");
});
