import { describe, it, expect } from "vitest";
import { FIELDS, TEMPLATE_HEADERS, GROUPS, splitExtra } from "../src/lib/studentFields.js";
import { parseStudentRows } from "../src/lib/students.js";

const sample = { text: "Sample", textarea: "Some text", tel: "08031234567", email: "parent@example.com", date: "01/09/2025", state: "Lagos", lga: "Ojo" };
describe("template and importer share one field list", () => {
  it("has a heading for every field, no duplicates, and every group is used", () => {
    expect(new Set(TEMPLATE_HEADERS).size).toBe(TEMPLATE_HEADERS.length);
    for (const f of FIELDS) expect(TEMPLATE_HEADERS).toContain(f.label);
    for (const [g] of GROUPS) expect(FIELDS.some((f) => f.group === g) || g === "student").toBe(true);
  });
  it("reads back every template column from a filled row", () => {
    const row = TEMPLATE_HEADERS.map((h) => {
      if (h === "Name") return "ADEBAYO Temitope"; if (h === "Gender") return "F"; if (h === "Class") return "SS1"; if (h === "Arm") return "A";
      if (h === "Admission no.") return "2026/001"; if (h === "Repeater") return "R"; if (h === "Date of birth") return "05/01/2010";
      const f = FIELDS.find((x) => x.label === h); return f.type === "select" ? f.options[0] : sample[f.type];
    });
    const [r] = parseStudentRows(`${TEMPLATE_HEADERS.map((h) => `"${h}"`).join(",")}\n${row.map((c) => `"${c}"`).join(",")}`);
    expect(r).toMatchObject({ name: "ADEBAYO TEMITOPE", gender: "F", class: "SS1", arm: "A", admissionNo: "2026/001", repeater: true, dob: "2010-01-05" });
    expect(r.badFields).toEqual([]);
    for (const f of FIELDS) expect(r.extra[f.key], f.key).toBeTruthy();
    expect(r.extra.admissionDate).toBe("2025-09-01"); expect(r.extra.phone).toBe("08031234567"); expect(r.extra.bloodGroup).toBe("A+");
  });
  it("keeps health and family details in the private record and the main contact name on the student", () => {
    const { student, priv } = splitExtra({ parentName: "Mr Ade", phone: "08031234567", allergies: "Peanuts", genotype: "AS", admissionDate: "2025-09-01" });
    expect(student).toEqual({ parentName: "Mr Ade", admissionDate: "2025-09-01" });
    expect(priv).toEqual({ phone: "08031234567", allergies: "Peanuts", genotype: "AS" });
  });
  it("blanks and reports values it cannot read, and matches selects ignoring case", () => {
    const [r] = parseStudentRows("Name,Genotype,Blood group,Father's phone,Parent/guardian email\nA B,as,o+,12,notanemail");
    expect(r.extra).toEqual({ genotype: "AS", bloodGroup: "O+" });
    expect(r.badFields.sort()).toEqual(["Father's phone", "Parent/guardian email"]);
  });
  it("accepts older templates and different heading spellings", () => {
    const [r] = parseStudentRows("Name,Gender,Class,Arm,Admission no.,Repeater,Date of birth,Parent/guardian name,Address,Parent phone\nA B,M,SS1,A,1,,01/02/2010,Mr B,Ojo Road,8031234567");
    expect(r).toMatchObject({ parentName: "Mr B", address: "Ojo Road", phone: "08031234567" });
    const [q] = parseStudentRows("Student name,Sex,Section,Mother,Emergency contact\nA B,F,Science,Mrs B,Mr C");
    expect(q).toMatchObject({ gender: "F", arm: "Science", extra: { motherName: "Mrs B", emergencyName: "Mr C" } });
  });
});
