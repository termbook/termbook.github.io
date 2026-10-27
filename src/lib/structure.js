/**
 * Which subjects are taught at which level. JSS (JSS1-3) and SS (SS1-3) have different subjects, and a teacher
 * is assigned exact (subject, class, arm) pairs, never a subject for every class.
 * Schools saved before this change only have a flat `subjects` list; it is split with the rules below.
 */
export const DEFAULT_SUBJECTS_BY_LEVEL = {
  JSS: ["English Studies", "Mathematics", "Basic Science", "Basic Technology", "Social Studies", "Civic Education", "Computer Studies", "Agricultural Science", "Business Studies", "Home Economics", "Christian Religious Studies", "Islamic Religious Studies", "Physical and Health Education", "Cultural and Creative Arts", "Yoruba", "Igbo", "Hausa", "French"],
  SS: ["English Language", "Mathematics", "Further Mathematics", "Biology", "Chemistry", "Physics", "Agricultural Science", "Economics", "Government", "Literature in English", "Geography", "History", "Accounting", "Commerce", "Civic Education", "Computer Studies", "Christian Religious Studies", "Islamic Religious Studies", "Physical and Health Education", "Yoruba", "Igbo", "Hausa", "French"],
};
const JSS_ONLY = new Set(["English Studies", "Basic Science", "Basic Technology", "Social Studies", "Business Studies", "Home Economics", "Cultural and Creative Arts"]);
const SS_ONLY = new Set(["Further Mathematics", "Biology", "Chemistry", "Physics", "Economics", "Government", "Literature in English", "Geography", "History", "Accounting", "Commerce", "Financial Accounting"]);

/** The arms of a class. A class with no arms is one unnamed stream, written as an empty arm. */
export const armsOf = (c) => (c?.arms?.length ? c.arms : [""]);
export const levelOf = (className) => (String(className).toUpperCase().startsWith("JSS") ? "JSS" : "SS");

export function subjectsByLevel(structure) {
  if (structure?.subjectsByLevel?.JSS && structure.subjectsByLevel.SS) return structure.subjectsByLevel;
  const flat = structure?.subjects?.length ? structure.subjects : [...new Set([...DEFAULT_SUBJECTS_BY_LEVEL.JSS, ...DEFAULT_SUBJECTS_BY_LEVEL.SS])];
  return { JSS: flat.filter((s) => !SS_ONLY.has(s)), SS: flat.filter((s) => !JSS_ONLY.has(s)) };
}
export const subjectsForClass = (structure, className) => subjectsByLevel(structure)[levelOf(className)];
export const allSubjects = (structure) => { const b = subjectsByLevel(structure); return [...new Set([...b.JSS, ...b.SS])].sort((x, y) => x.localeCompare(y)); };
/** Classes (with their arms) where a subject is taught. */
export const classesForSubject = (structure, subject) => structure.classes.filter((c) => subjectsForClass(structure, c.name).includes(subject));
/** Flat list kept in the school record for older screens and exports. */
export const unionSubjects = (byLevel) => [...new Set([...byLevel.JSS, ...byLevel.SS])];
