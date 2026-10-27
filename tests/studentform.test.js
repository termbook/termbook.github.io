// @vitest-environment jsdom
import { it, expect, vi, beforeAll } from "vitest";

const added = [];
vi.mock("../src/lib/data.js", () => ({
  watchStudents: (cb) => { cb([]); return () => {}; }, addStudent: async (s, p) => { added.push([s, p]); return "id"; }, addStudents: async () => {}, updateStudent: async () => {},
  bulkStudentAction: async () => {}, loadPrivate: async () => ({}), issueAccessCode: async () => {}, revokeAccess: async () => {}, loadAccessCode: async () => null, studentIdFor: (x) => x,
}));
vi.mock("../src/views/common.js", async (orig) => ({ ...(await orig()), loadNg: async () => [{ name: "Lagos", lgas: ["Ojo", "Ikeja"] }] }));
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function (v) { this.returnValue = v || ""; this.removeAttribute("open"); this.dispatchEvent(new Event("close")); }; });

it("shows every section, and saves family, health and other details", async () => {
  const { state } = await import("../src/lib/store.js"); const { studentsView } = await import("../src/views/students.js");
  Object.assign(state, { isOwner: false, profile: { role: "admin", classKeys: [] }, school: { structure: { classes: [{ name: "SS1", arms: ["A"] }] } } });
  const host = document.createElement("div"); document.body.append(host); studentsView(host);
  [...host.querySelectorAll("button")].find((b) => b.textContent === "Add student").click();
  const dlg = document.querySelector("dialog");
  const legends = [...dlg.querySelectorAll("legend")].map((l) => l.textContent);
  expect(legends).toEqual(["Student details", "Parent or guardian (main contact)", "Father and mother (optional)", "Emergency contact", "Health (private)", "Other"]);
  const set = (id, v) => { const el = dlg.querySelector("#" + id); el.value = v; el.dispatchEvent(new Event("change")); };
  set("n", "Ade Bola");
  const picker = [...dlg.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "SS1|A")); picker.value = "SS1|A";
  set("f_parentName", "Mr Bola"); set("f_phone", "0803 123 4567"); set("f_allergies", "Peanuts"); set("f_bloodGroup", "O+"); set("f_fatherName", "Mr Bola"); dlg.querySelector("#f_admissionDate").value = "2025-09-01";
  dlg.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 20));
  expect(added).toHaveLength(1);
  const [stu, priv] = added[0];
  expect(stu).toMatchObject({ name: "ADE BOLA", class: "SS1", arm: "A", parentName: "Mr Bola", admissionDate: "2025-09-01" });
  expect(stu.allergies).toBeUndefined();
  expect(priv).toMatchObject({ phone: "08031234567", allergies: "Peanuts", bloodGroup: "O+", fatherName: "Mr Bola" });
});

it("a class with no arms can be chosen on its own, and the section (Technical) is a choice", async () => {
  const { state } = await import("../src/lib/store.js"); const { studentsView } = await import("../src/views/students.js");
  Object.assign(state, { isOwner: false, profile: { role: "admin", classKeys: [] }, school: { structure: { classes: [{ name: "SS2", arms: [] }], departments: ["Science", "Arts", "Commercial", "Technical"] } } });
  added.length = 0; document.body.replaceChildren(); const host = document.createElement("div"); document.body.append(host); studentsView(host);
  [...host.querySelectorAll("button")].find((b) => b.textContent === "Add student").click();
  const dlg = document.querySelector("dialog"); const picker = [...dlg.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "SS2|"));
  expect([...picker.options].map((o) => o.textContent)).toContain("SS2");
  const cat = dlg.querySelector("#f_category"); expect([...cat.options].map((o) => o.value)).toEqual(["", "Science", "Arts", "Commercial", "Technical"]);
  const set = (id, v) => { const el = dlg.querySelector("#" + id); el.value = v; el.dispatchEvent(new Event("change")); };
  set("n", "Ade Bola"); picker.value = "SS2|"; cat.value = "Technical";
  dlg.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true })); await new Promise((r) => setTimeout(r, 20));
  expect(added[0][0]).toMatchObject({ name: "ADE BOLA", class: "SS2", arm: "", category: "Technical" });
});
