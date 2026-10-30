// @vitest-environment jsdom
import { it, expect, vi, beforeAll } from "vitest";
const calls = [];
const school = { id: "s1", name: "KBI Schools", status: "verified", type: "private", lga: "Ibadan North", state: "Oyo", phone: "08031234567" };
const oldAdmin = { id: "adm1", name: "Old Admin", email: "old@x.com", role: "admin", schoolId: "s1" };
const teachers = [{ id: "t1", name: "Mrs Bello", email: "bello@x.com", role: "teacher", schoolId: "s1", status: "active" }, { id: "t2", name: "Mr Ade", email: "ade@x.com", role: "teacher", schoolId: "s1", status: "pending" }];
const away = { id: "t9", name: "Mr Away", email: "away@x.com", role: "teacher", schoolId: "other", status: "active" };
vi.mock("../src/lib/data.js", () => ({
  ownerSchools: async () => [school], ownerSetSchoolStatus: async () => {}, adminsOf: async () => [oldAdmin], teachersOfSchool: async () => teachers,
  findTeacherByEmail: async (e) => (e === "away@x.com" ? [away] : []), replaceAdmin: async (...a) => { calls.push(a); }, getPlatform: async () => ({}), setPlatform: async () => {}, loadAudit: async () => [], nationalHolidays: async () => [], saveNationalHolidays: async () => {},
}));
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function (v) { this.returnValue = v || ""; this.removeAttribute("open"); this.dispatchEvent(new Event("close")); }; });
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

it("the owner replaces a school's admin with one of its teachers, after a confirmation, choosing what happens to the old admin", async () => {
  const { ownerSchoolsView } = await import("../src/views/owner.js"); const host = document.createElement("div"); document.body.append(host); await ownerSchoolsView(host, () => {}); await tick();
  [...host.querySelectorAll("button")].find((b) => b.textContent === "Replace admin").click(); await tick(60);
  const dlg = document.querySelector("dialog"); expect(dlg.textContent).toContain("Old Admin (old@x.com)"); expect(dlg.textContent).toContain("must already have an account");
  dlg.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true })); await tick(); expect(dlg.textContent).toContain("Choose the new admin first.");
  const sel = dlg.querySelector("#ra_t"); expect([...sel.options].map((o) => o.textContent)).toEqual(["Choose a teacher of this school", "Mrs Bello (bello@x.com)", "Mr Ade (ade@x.com), pending"]);
  sel.value = "t1"; sel.dispatchEvent(new Event("change")); expect(dlg.textContent).toContain("New admin: Mrs Bello"); dlg.querySelector("#ra_o").value = "teacher";
  dlg.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true })); await tick();
  const confirm = [...document.querySelectorAll("dialog")].pop(); expect(confirm.textContent).toContain("becomes a teacher waiting for approval"); confirm.querySelector(".btn-danger").click(); await tick(60);
  expect(calls.length).toBe(1); const [sch, user, olds, action] = calls[0]; expect([sch.id, user.id, olds.map((o) => o.id), action]).toEqual(["s1", "t1", ["adm1"], "teacher"]);
});
it("a teacher from another school can be found by email (and the owner is told they will be moved); unknown emails are refused", async () => {
  calls.length = 0; document.body.replaceChildren(); const { ownerSchoolsView } = await import("../src/views/owner.js"); const host = document.createElement("div"); document.body.append(host); await ownerSchoolsView(host, () => {}); await tick();
  [...host.querySelectorAll("button")].find((b) => b.textContent === "Replace admin").click(); await tick(60); const dlg = document.querySelector("dialog");
  dlg.querySelector("#ra_e").value = "nobody@x.com"; [...dlg.querySelectorAll("button")].find((b) => b.textContent === "Find").click(); await tick(); expect(dlg.textContent).toContain("No teacher account found");
  dlg.querySelector("#ra_e").value = "away@x.com"; [...dlg.querySelectorAll("button")].find((b) => b.textContent === "Find").click(); await tick(); expect(dlg.textContent).toContain("belongs to another school and will be moved");
});
