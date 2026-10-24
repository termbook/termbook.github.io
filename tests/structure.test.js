import { describe, it, expect } from "vitest";
import { subjectsForClass, classesForSubject, subjectsByLevel, allSubjects, levelOf, DEFAULT_SUBJECTS_BY_LEVEL } from "../src/lib/structure.js";
const structure = { classes: ["JSS1", "JSS3", "SS2"].map((name) => ({ name, arms: ["A", "B"] })) };
describe("subjects by level", () => {
  it("separates JSS and SS subjects", () => {
    expect(subjectsForClass(structure, "JSS3")).toContain("Basic Science");
    expect(subjectsForClass(structure, "SS2")).not.toContain("Basic Science");
    expect(subjectsForClass(structure, "SS2")).toContain("Biology");
    expect(subjectsForClass(structure, "JSS3")).not.toContain("Biology");
    expect(levelOf("JSS1")).toBe("JSS"); expect(levelOf("SS3")).toBe("SS");
  });
  it("offers a subject only in classes where it is taught", () => {
    expect(classesForSubject(structure, "Basic Science").map((c) => c.name)).toEqual(["JSS1", "JSS3"]);
    expect(classesForSubject(structure, "Biology").map((c) => c.name)).toEqual(["SS2"]);
    expect(classesForSubject(structure, "Mathematics").map((c) => c.name)).toEqual(["JSS1", "JSS3", "SS2"]);
  });
  it("splits an older flat subject list sensibly", () => {
    const old = { classes: structure.classes, subjects: ["English Language", "Mathematics", "Basic Science", "Biology", "Civic Education"] };
    const b = subjectsByLevel(old);
    expect(b.JSS).toEqual(["English Language", "Mathematics", "Basic Science", "Civic Education"]);
    expect(b.SS).toEqual(["English Language", "Mathematics", "Biology", "Civic Education"]);
  });
  it("uses the school's own per-level lists when saved", () => {
    const own = { classes: structure.classes, subjectsByLevel: { JSS: ["Basic Science"], SS: ["Mathematics"] } };
    expect(subjectsForClass(own, "JSS1")).toEqual(["Basic Science"]); expect(allSubjects(own)).toEqual(["Basic Science", "Mathematics"]);
    expect(DEFAULT_SUBJECTS_BY_LEVEL.JSS.length).toBeGreaterThan(10);
  });
});
