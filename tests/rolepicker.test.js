// @vitest-environment jsdom
import { it, expect } from "vitest";
import { rolePicker } from "../src/views/common.js";
it("picks exact pairs", () => {
  const structure = { classes: ["JSS3", "SS2"].map((name) => ({ name, arms: name === "SS2" ? ["Science", "Arts"] : ["A", "B"] })) };
  const rp = rolePicker(structure, {});
  document.body.append(rp.el);
  const det = (n) => [...rp.el.querySelectorAll("details")].find((d) => d.dataset.name === n.toLowerCase());
  expect(det("Biology").querySelectorAll(".cls-row").length).toBe(1);        // SS only
  expect(det("Basic Science").querySelectorAll(".cls-row").length).toBe(1);  // JSS only
  expect(det("Mathematics").querySelectorAll(".cls-row").length).toBe(2);
  // Basic Science for all JSS3 arms
  det("Basic Science").querySelector(".cls-row input").click();
  // Mathematics for all SS2 arms (second class row, "All" box)
  det("Mathematics").querySelectorAll(".cls-row")[1].querySelector("input").click();
  const sel = rp.el.querySelector("select"); sel.value = "SS2|Science"; 
  const r = rp.get();
  expect(r.classTeacher).toEqual({ class: "SS2", arm: "Science" });
  expect(r.assignments.map((a) => `${a.subject} ${a.class}${a.arm}`).sort()).toEqual(["Basic Science JSS3A", "Basic Science JSS3B", "Mathematics SS2Arts", "Mathematics SS2Science"]);
});
it("pre-fills an existing teacher exactly", () => {
  const structure = { classes: ["JSS3", "SS2"].map((name) => ({ name, arms: ["A"] })) };
  const rp = rolePicker(structure, { assignments: [{ subject: "Mathematics", class: "SS2", arm: "A" }] });
  expect(rp.get().assignments).toEqual([{ subject: "Mathematics", class: "SS2", arm: "A" }]);
  const m = [...rp.el.querySelectorAll("details")].find((d) => d.dataset.name === "mathematics");
  expect(m.open).toBe(true); expect([...m.querySelectorAll("input")].filter((i) => i.checked).length).toBe(2); // arm + All
});

it("shows a saved pair that the school does not offer, so it can be unticked", () => {
  const structure = { classes: ["JSS3", "SS2"].map((name) => ({ name, arms: ["A"] })) };
  const rp = rolePicker(structure, { assignments: [{ subject: "Basic Science", class: "SS2", arm: "A" }, { subject: "Basic Science", class: "JSS3", arm: "A" }] });
  document.body.append(rp.el);
  const warn = rp.el.querySelector(".fs-warn"); expect(warn).not.toBeNull(); expect(warn.textContent).toContain("Basic Science, SS2A");
  warn.querySelector("input").click();
  expect(rp.get().assignments).toEqual([{ subject: "Basic Science", class: "JSS3", arm: "A" }]);
});
