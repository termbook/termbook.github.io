/**
 * Student report card model, in the layout of the Oyo State school report card.
 * Pure functions: they turn score sheets, attendance and ratings into a plain object that the card renders and that is stored when a term is published.
 */
import { calc, DEFAULT_WEIGHTS, DEFAULT_GRADES } from "./scores.js";
import { toSheetModel } from "./reports.js";
import { subjectsForClass } from "./structure.js";
import { classKey as makeKey } from "./students.js";

export const AFFECTIVE = [["punctuality", "Punctuality"], ["neatness", "Neatness"], ["attentiveness", "Attentiveness"], ["relationship", "Relationship with others"], ["politeness", "Politeness"], ["responsiveness", "Responsiveness"], ["commitment", "Commitment"], ["consistency", "Consistency"]];
export const PSYCHOMOTOR = [["crafts", "Crafts/Drawing & Painting"], ["technical", "Technical skills"], ["ict", "ICT skills"], ["gardening", "Gardening/Farming skills"], ["games", "Games & Sports"], ["creativity", "Creativity & Initiative"], ["verbal", "Verbal fluency"]];
export const RATING_NAME = { 5: "Excellent", 4: "Good", 3: "Average", 2: "Below Average", 1: "Fair" };
export const ratingText = (n) => (RATING_NAME[n] ? `${RATING_NAME[n].toUpperCase()}(${n})` : "");

/** The grading used on Oyo State report cards: A, C, P, F. */
export const OYO_GRADES = [
  { min: 70, g: "A", label: "Distinction", remark: "Distinction" }, { min: 50, g: "C", label: "Credit", remark: "Good" },
  { min: 40, g: "P", label: "Pass", remark: "Pass" }, { min: 0, g: "F", label: "Fail", remark: "Fail" },
];
export const OYO_REPORT = { heading: "OYO STATE MINISTRY OF EDUCATION, SCIENCE AND TECHNOLOGY", footerCredit: "POWERED BY PLANNING, RESEARCH AND STATISTICS DEPARTMENT, EMIS UNIT", tutorComment: "Shows consistent effort and improvement in academic work.", principalComment: "A good performance" };
const FALLBACK = { A: ["Excellent", "Excellent"], B: ["Very good", "Very good"], C: ["Credit", "Good"], D: ["Fair", "Fair"], E: ["Pass", "Pass"], F: ["Fail", "Fail"], P: ["Pass", "Pass"] };

/** Rounds to one decimal place, half up: 71.67 shows as 71.7. */
export const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
const sum1 = (n) => Math.round(n * 10) / 10;
export function gradeInfo(value, grades = DEFAULT_GRADES) {
  const b = grades.find((x) => value >= x.min) || grades[grades.length - 1]; const fb = FALLBACK[b.g] || [b.g, b.g];
  return { g: b.g, label: b.label || fb[0], remark: b.remark || fb[1], failing: b === grades[grades.length - 1] };
}
export const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || "th");
export function longDate(iso) {
  if (!iso) return ""; const d = new Date(`${iso}T00:00:00`); if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-GB", { weekday: "long" })}, ${ordinal(d.getDate())} ${d.toLocaleDateString("en-GB", { month: "long" })}, ${d.getFullYear()}`;
}
export function ageOn(dob, today) { if (!dob) return ""; const b = new Date(`${dob}T00:00:00`), t = new Date(`${today}T00:00:00`); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a >= 0 && a < 60 ? a : ""; }
/** Senior classes are written SSS1 to SSS3 on these cards. */
export const cardClassName = (cls) => String(cls).replace(/^SS(\d)/, "SSS$1");
const TERM_NAME = { 1: "FIRST", 2: "SECOND", 3: "THIRD" };
const isCore = (s) => /^(general )?mathematics$/i.test(s) || /^english( language| studies)?$/i.test(s);
const orderSubjects = (list) => [...new Set(list)].sort((a, b) => (isCore(b) - isCore(a)) || (isCore(a) && isCore(b) ? (/math/i.test(b) - /math/i.test(a)) : a.localeCompare(b)));

/**
 * One card per enrolled student for the given term.
 * attendance: { studentId: { opened, present } } (marks, two per school day). remarks: { studentId: { ratings, tutorComment, principalComment, tutorName } }.
 */
export function buildClassCards({ roster, sheets, term, session, school, nextTermBegins = "", attendance = {}, remarks = {}, today }) {
  const w = school.scoring?.weights || DEFAULT_WEIGHTS, grades = school.scoring?.grades || DEFAULT_GRADES, rep = school.report || {};
  const final = term === 3; const maxEach = w.a + w.b + w.c + w.e; const out = [];
  const byClass = {}; roster.forEach((s) => (byClass[s.classKey] ||= []).push(s));
  const stateName = String(school.state || "").replace(/\s+State$/i, "");
  const heading = rep.heading || (stateName ? `${stateName.toUpperCase()} STATE MINISTRY OF EDUCATION` : "");
  const subheading = rep.subheading || [school.name, school.address].filter(Boolean).join(", ").toUpperCase();
  for (const [key, list0] of Object.entries(byClass)) {
    const list = list0.slice().sort((a, b) => a.name.localeCompare(b.name)); const cls = list[0].class;
    const classSheets = sheets.filter((sh) => sh.classKey === key);
    const subjects = orderSubjects([...subjectsForClass(school.structure, cls), ...classSheets.map((sh) => sh.subject)]);
    const models = new Map(classSheets.map((sh) => [sh.subject, toSheetModel(sh, list)]));
    const cards = list.map((stu, idx) => {
      const rows = subjects.map((subject, i) => {
        const c = models.get(subject); const x = c ? calc(c, term, stu.id, w) : null;
        if (!x) return { sn: i + 1, subject, offered: false, ca: 0, exam: 0, total: 0, t2: 0, t1: 0, avg: 0, grade: "NA", remark: final ? "NA" : "NOT APPLICABLE" };
        const row = { sn: i + 1, subject, offered: true, ca: x.a + x.b + x.c, exam: x.ex, total: x.t, t2: 0, t1: 0, avg: 0 };
        let value = x.t;
        if (final) { const t1 = calc(c, 1, stu.id, w), t2 = calc(c, 2, stu.id, w); row.t1 = t1 ? t1.t : 0; row.t2 = t2 ? t2.t : 0; const scored = [x.t, t1?.t, t2?.t].filter((v) => v !== undefined && v !== null); row.avg = round1(scored.reduce((p, n) => p + n, 0) / scored.length); value = row.avg; }
        const gi = gradeInfo(value, grades); row.grade = gi.g; row.remark = gi.remark.toUpperCase(); row.failing = gi.failing; return row;
      });
      const offered = rows.filter((r) => r.offered); const obtained = sum1(offered.reduce((p, r) => p + (final ? r.avg : r.total), 0)); const obtainable = offered.length * maxEach;
      const at = attendance[stu.id] || {}; const rm = remarks[stu.id] || {}; const ratings = rm.ratings || {};
      const block = (items) => { const list2 = items.map(([k, label]) => ({ label, rating: ratings[k] || 0, text: ratingText(ratings[k]) })); const rated = list2.filter((i) => i.rating); return { items: list2, total: rated.length * 5, obtained: rated.reduce((p, i) => p + i.rating, 0) }; };
      return {
        schoolId: school.id || "", classKey: key, term, termName: TERM_NAME[term], session, final, studentId: stu.id, pct: { ca: w.a + w.b + w.c, exam: w.e },
        header: { heading, subheading, footerCredit: rep.footerCredit || "" },
        student: { sn: idx + 1, name: stu.name, gender: stu.gender === "F" ? "FEMALE" : stu.gender === "M" ? "MALE" : "", admissionNo: stu.admissionNo || "", className: cardClassName(cls) + (stu.arm ? ` ${stu.arm}` : ""), classCategory: stu.category || ((school.structure?.departments || []).some((d) => d.toLowerCase() === String(stu.arm || "").toLowerCase()) ? stu.arm : ""), age: ageOn(stu.dob, today || new Date().toISOString().slice(0, 10)) },
        counts: { offered: offered.length, passed: offered.filter((r) => !r.failing).length, failed: offered.filter((r) => r.failing).length, classSize: list.length, position: 0 },
        attendance: { opened: at.opened ?? "", present: at.present ?? "", absent: at.opened === undefined || at.opened === "" ? "" : Math.max(0, at.opened - (at.present || 0)) },
        rows, totals: { obtainable, obtained, percent: obtainable ? round1(obtained / obtainable * 100) : 0 },
        gradeKey: grades.map((g) => ({ g: g.g, label: g.label || (FALLBACK[g.g] || [g.g])[0] })),
        affective: block(AFFECTIVE), psychomotor: block(PSYCHOMOTOR),
        comments: { tutor: rm.tutorComment ?? rep.tutorComment ?? "", principal: rm.principalComment ?? rep.principalComment ?? "", tutorName: rm.tutorName || "", signature: school.branding?.signature || "" },
        footer: { nextTerm: nextTermBegins ? `Next Term Begins on ${longDate(nextTermBegins)}.` : "" },
      };
    });
    const scored = cards.filter((c) => c.counts.offered > 0);
    // Class position: rank by total percentage; equal percentages share a position.
    // Class averages, so a student (or a parent) can compare with the class without seeing anyone else's marks.
    const mean = (a) => (a.length ? round1(a.reduce((p, n) => p + n, 0) / a.length) : 0);
    subjects.forEach((sub, i) => { const avg = mean(cards.map((c) => c.rows[i]).filter((r) => r.offered).map((r) => r.total)); cards.forEach((c) => { c.rows[i].classAvg = avg; }); });
    const classPct = mean(scored.map((c) => c.totals.percent)); cards.forEach((c) => { c.totals.classPercent = classPct; });
    cards.forEach((c) => { c.counts.position = c.counts.offered ? 1 + scored.filter((o) => o.totals.percent > c.totals.percent).length : 0; });
    out.push(...cards);
  }
  return out;
}
export { makeKey };
