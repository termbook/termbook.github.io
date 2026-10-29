// @vitest-environment jsdom
import { it, expect } from "vitest";
import { lineChart, barChart, sparkline } from "../src/lib/charts.js";

it("line chart: one dot per value, gaps for missing values, a legend for several series, and a numbers table", () => {
  const c = lineChart({ title: "Overall percentage", labels: ["1st term", "2nd term", "3rd term"], series: [{ name: "Student", values: [60, null, 72] }, { name: "Class average", values: [55, 58, 60] }], unit: "%", summary: "Up from 60 to 72." });
  expect(c.querySelectorAll("circle").length).toBe(5); const paths = [...c.querySelectorAll("path.ch-line")]; expect(paths.length).toBe(2); expect(paths[0].getAttribute("d").match(/M/g).length).toBe(2); // the student line is drawn in two pieces around the gap
  expect(c.querySelector("svg").getAttribute("aria-label")).toContain("Up from 60 to 72."); expect(c.querySelectorAll(".ch-legend span").length).toBe(2);
  expect(c.querySelector(".ch-data table").textContent).toContain("Class average"); expect(c.querySelector("circle title").textContent).toBe("Student, 1st term: 60%");
});
it("line chart can put 1 at the top (class position) and shows a message when there is no data", () => {
  const p = lineChart({ title: "Position", labels: ["T1", "T2"], series: [{ name: "Position", values: [8, 3] }], yMin: 1, yMax: 10, reverse: true });
  const [a, b] = [...p.querySelectorAll("circle")].map((x) => +x.getAttribute("cy")); expect(b).toBeLessThan(a);   // 3rd place is drawn higher than 8th
  expect(lineChart({ title: "x", labels: ["a"], series: [{ name: "s", values: [null] }] }).textContent).toContain("No data yet");
});
it("bar chart (horizontal) draws a bar and a class-average tick per subject, and shortens long names", () => {
  const c = barChart({ title: "Subjects", horizontal: true, items: [{ label: "Mathematics", value: 72, marker: 60 }, { label: "Literature in English and Drama", value: 40, marker: 55 }], unit: "%", valueName: "Student" });
  expect(c.querySelectorAll("rect.ch-bar").length).toBe(2); expect(c.querySelectorAll("line.ch-marker").length).toBe(2); expect(c.textContent).toContain("Literature in English…"); expect(c.querySelectorAll(".ch-legend span").length).toBe(2);
});
it("bar chart (vertical) and sparkline render", () => {
  const c = barChart({ title: "Score spread", items: [{ label: "0-39", value: 2 }, { label: "40-49", value: 5 }], max: 10 }); expect(c.querySelectorAll("rect.ch-bar").length).toBe(2);
  expect(sparkline([50, 60, null, 70]).querySelectorAll("path").length).toBe(1); expect(sparkline([50]).querySelectorAll("path").length).toBe(0);
});
