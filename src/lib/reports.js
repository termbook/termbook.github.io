/** Builds compiled report cards from score sheets. Pure functions, covered by tests. */
import { calc, annual, rankOf, grade, termStats, DEFAULT_WEIGHTS, DEFAULT_GRADES } from "./scores.js";

/** Converts one stored sheet + the roster into the shape logic uses. */
export function toSheetModel(sheet, roster) {
  const students = {}; roster.forEach((s) => (students[s.id] = { n: s.name, s: s.gender, r: s.repeater }));
  return { subject: sheet.subject, bonus: sheet.bonus !== false, scores: sheet.scores || {}, students };
}

/**
 * One report per enrolled student for a term: every subject with scores, grade and position in that subject,
 * plus total, average and overall position in the class.
 */
export function buildReports({ roster, sheets, term, weights = DEFAULT_WEIGHTS, grades = DEFAULT_GRADES, attendance = {} }) {
  const byClass = {}; roster.forEach((s) => (byClass[s.classKey] ||= []).push(s));
  const out = [];
  for (const [key, list] of Object.entries(byClass)) {
    const models = sheets.filter((sh) => sh.classKey === key).map((sh) => ({ sh, c: toSheetModel(sh, list) }));
    const rows = list.map((s) => {
      const subjects = [];
      for (const { sh, c } of models) {
        const x = calc(c, term, s.id, weights); if (!x) continue;
        const pos = rankOf(c, term, s.id, weights);
        subjects.push({ subject: sh.subject, a: x.a, b: x.b, c: x.c, ex: x.ex, t: x.t, grade: grade(x.t, grades), pos: pos.p, of: pos.n, annual: annual(c, s.id, weights).avg });
      }
      subjects.sort((p, q) => p.subject.localeCompare(q.subject));
      const total = subjects.reduce((n, x) => n + x.t, 0);
      return { studentId: s.id, admissionNo: s.admissionNo, name: s.name, class: s.class, arm: s.arm, classKey: key, term, subjects, total, average: subjects.length ? Math.round(total / subjects.length * 10) / 10 : null, attendance: attendance[s.id] || null };
    });
    const scored = rows.filter((r) => r.average !== null);
    rows.forEach((r) => { r.position = r.average === null ? null : 1 + scored.filter((o) => o.total > r.total).length; r.classSize = scored.length; });
    out.push(...rows);
  }
  return out;
}
export { termStats };
