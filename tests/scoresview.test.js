// @vitest-environment jsdom
import { it, expect, vi } from "vitest";

const saved = [];
const roster = [
  { id: "a", name: "ADE BOLA", gender: "M", classKey: "SS2|A", status: "active" }, { id: "b", name: "BELLO AMINAT", gender: "F", classKey: "SS2|A", status: "active" },
  { id: "c", name: "CHUKWU OBI", gender: "M", classKey: "SS2|A", status: "active" },
];
vi.mock("../src/lib/data.js", () => ({
  watchStudents: (cb) => { cb(roster); return () => {}; }, loadSheet: async () => null, saveSheetFlag: async () => {}, sheetId: () => "x",
  saveCell: async (...args) => { saved.push(args); },
}));
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

it("shows a modern score sheet that totals, grades and ranks live", async () => {
  const { state } = await import("../src/lib/store.js"); const { scoresView } = await import("../src/views/scores.js");
  const { DEFAULT_WEIGHTS, DEFAULT_GRADES } = await import("../src/lib/scores.js");
  Object.assign(state, { isOwner: false, profile: { role: "teacher", name: "T", assignmentsList: [{ subject: "Mathematics", class: "SS2", arm: "A" }] },
    school: { name: "Test School", current: { session: "2026/2027", term: 1 }, structure: { classes: [{ name: "SS2", arms: ["A"] }] }, scoring: { weights: DEFAULT_WEIGHTS, grades: DEFAULT_GRADES } } });
  const host = document.createElement("div"); document.body.append(host); await scoresView(host); await tick();
  const rows = host.querySelectorAll(".srow"); expect(rows.length).toBe(3);
  expect(host.querySelector(".kpis").textContent).toContain("0 / 3");
  const input = (id, k) => host.querySelector(`input[data-s="${id}"][data-k="${k}"]`);
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
  type(input("a", "a"), "15");                       // over the maximum of 10
  expect(input("a", "a").value).toBe("10");          // clamped
  type(input("a", "b"), "8"); type(input("a", "c"), "9"); type(input("a", "e"), "60"); type(input("a", "at"), "5"); type(input("a", "tb"), "5");
  const rowA = rows[0]; expect(rowA.querySelector(".tot").textContent).toBe("97"); // 10 + 8 + 9 + exam capped at 70
  type(input("c", "e"), "50");
  expect(host.querySelector(".kpis").textContent).toContain("2 / 3");
  expect(rowA.querySelector(".gchip").textContent).toBe("A");
  expect(rowA.classList.contains("done")).toBe(true);
  await tick(700); expect(saved.length).toBeGreaterThan(5);
  host.querySelectorAll(".subtabs button")[1].click(); await tick();
  const trs = [...host.querySelectorAll(".results tbody tr")];
  expect(trs.map((r) => r.querySelector("th").textContent)).toEqual(["ADE BOLA", "CHUKWU OBI"]);
  expect(trs[0].querySelector(".posc").textContent).toContain("🥇");
});
