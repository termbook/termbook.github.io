/**
 * Sample templates for report card conduct ratings and comments.
 * Conduct templates fill all fifteen traits at once. Comment templates are bands by the student's total percentage;
 * a school can replace them in Setup > Report card (one per line: lowest percentage | comment).
 */
import { AFFECTIVE, PSYCHOMOTOR } from "./reportcard.js";

const all = (n) => Object.fromEntries([...AFFECTIVE, ...PSYCHOMOTOR].map(([k]) => [k, n]));
export const CONDUCT_TEMPLATES = [
  { id: "excellent", label: "Excellent: all traits 5", ratings: all(5) },
  { id: "very-good", label: "Very good: mostly 4, with 5 for punctuality, neatness, politeness and games", ratings: { ...all(4), punctuality: 5, neatness: 5, politeness: 5, games: 5 } },
  { id: "good", label: "Good: all traits 4", ratings: all(4) },
  { id: "average", label: "Average: all traits 3", ratings: all(3) },
  { id: "needs-improvement", label: "Needs improvement: all traits 2", ratings: all(2) },
];
export const DEFAULT_TUTOR_BANDS = [
  { min: 70, text: "An excellent student who shows outstanding effort and good conduct." },
  { min: 60, text: "A very good performance. Keep up the hard work." },
  { min: 50, text: "Shows consistent effort and improvement in academic work." },
  { min: 40, text: "A fair performance. More effort is needed, especially in the weaker subjects." },
  { min: 0, text: "Performance is below expectation. Needs closer attention and extra work." },
];
export const DEFAULT_PRINCIPAL_BANDS = [
  { min: 70, text: "An excellent result. Keep it up." },
  { min: 60, text: "A very good performance." },
  { min: 50, text: "A good performance" },
  { min: 40, text: "A fair result. Work harder." },
  { min: 0, text: "A weak result. There must be a serious improvement next term." },
];
const clean = (list) => (Array.isArray(list) ? list.filter((b) => b && b.text && Number.isFinite(+b.min)).map((b) => ({ min: +b.min, text: String(b.text) })).sort((a, b) => b.min - a.min) : []);
/** The school's own bands if it set any, otherwise the samples. */
export const bandsFor = (school, kind) => { const own = clean(school?.report?.[kind === "tutor" ? "tutorBands" : "principalBands"]); return own.length ? own : kind === "tutor" ? DEFAULT_TUTOR_BANDS : DEFAULT_PRINCIPAL_BANDS; };
/** The comment that fits a total percentage. */
export const commentFor = (bands, percent) => (bands.find((b) => percent >= b.min) || bands[bands.length - 1])?.text || "";
export const bandLine = (b) => `${b.min} | ${b.text}`;
export const parseBandLine = (l) => { const i = l.indexOf("|"); if (i < 0) return null; const min = +l.slice(0, i).trim(), text = l.slice(i + 1).trim(); return Number.isFinite(min) && text ? { min, text } : null; };
