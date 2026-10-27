// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
vi.mock("../src/lib/data.js", () => ({ saveRemarks: async () => {} }));
import { buildClassCards, OYO_GRADES, OYO_REPORT } from "../src/lib/reportcard.js";
import { renderReportCard } from "../src/views/reportcard.js";

const school = { id: "s1", name: "Knowledge Base International Schools", address: "Apapa, Moniya, Ibadan", state: "Oyo", structure: { classes: [{ name: "SS2", arms: ["A"] }], subjectsByLevel: { JSS: [], SS: ["General Mathematics", "English Language", "Biology"] } }, scoring: { weights: { a: 10, b: 10, c: 10, e: 70, at: 5, tb: 5, nb: 5 }, grades: OYO_GRADES }, report: { ...OYO_REPORT }, branding: { signature: "data:image/png;base64,AAAA" } };
const stu = { id: "s1", name: "OKERINDE JUMAIN", gender: "F", class: "SS2", arm: "A", classKey: "SS2|A", admissionNo: "KBI-026" };
const sheet = (subject, t) => ({ subject, classKey: "SS2|A", bonus: false, scores: { [t]: { s1: { a: 7, b: 5, c: 5, e: 31 } } } });

it("draws every part of the card from the data", () => {
  for (const term of [2, 3]) {
    const [card] = buildClassCards({ roster: [stu], sheets: [sheet("General Mathematics", term), sheet("English Language", term)], term, session: "2025/2026", school, nextTermBegins: "2026-04-27", attendance: { s1: { opened: 120, present: 110 } }, remarks: { s1: { ratings: { punctuality: 5, ict: 4 }, tutorName: "Mrs Ade" } } });
    const el = renderReportCard(card, { logo: "data:image/png;base64,BBBB", stateLogo: "data:image/png;base64,CCCC" }); document.body.append(el); const text = el.textContent;
    expect(text).toContain("OYO STATE MINISTRY OF EDUCATION, SCIENCE AND TECHNOLOGY"); expect(text).toContain("KNOWLEDGE BASE INTERNATIONAL SCHOOLS, APAPA, MONIYA, IBADAN");
    for (const s of ["STUDENT REPORT CARD", "OKERINDE JUMAIN", "KBI-026", "SSS2", "FEMALE", "COGNITIVE (ACADEMIC PERFORMANCE)", "TOTAL MARKS OBTAINABLE", "GRADE INTERPRETATION", "A: DISTINCTION", "BEHAVIOURAL (AFFECTIVE DOMAIN)", "PSYCHOMOTOR DOMAIN", "Class Tutor's Comment", "Mrs Ade", "Next Term Begins on Monday, 27th April, 2026.", "POWERED BY PLANNING"]) expect(text, s).toContain(s);
    expect(el.querySelectorAll(".rc-cog tbody tr").length).toBe(3); expect(el.querySelectorAll(".rc-cog tfoot tr").length).toBe(1);
    expect(el.querySelector("img.rc-logo").getAttribute("src")).toBe("data:image/png;base64,CCCC"); expect(el.querySelectorAll("img.rc-logo")[1].getAttribute("src")).toBe("data:image/png;base64,BBBB");
    expect(el.querySelector("img.rc-sign")).not.toBeNull();
    expect(text).toContain(term === 3 ? "Average Score in %" : "Total Score"); expect(text).toContain(term === 3 ? "3rd Term C.A." : "2nd Term Continuous Assessment");
    expect(el.querySelector(".rc-cog").classList.contains("rc-final")).toBe(term === 3); el.remove();
  }
});
