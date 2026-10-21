/** Student rules: class order, promotion, status, duplicates and codes. Pure functions, covered by tests. */
export const CLASS_ORDER = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];
export const STATUS = { active: "Active", pending: "Pending", left: "No longer in school", graduated: "Graduated" };
export const LEFT_REASONS = ["Withdrawn", "Transferred to another school", "Not returning", "Other"];
export const classKey = (cls, arm) => `${cls}|${arm}`;
export const splitKey = (k) => { const [cls, arm] = String(k).split("|"); return { cls, arm }; };
export const normName = (n) => String(n || "").toUpperCase().replace(/\s+/g, " ").trim();
export const nextClass = (cls) => { const i = CLASS_ORDER.indexOf(cls); return i < 0 ? null : (CLASS_ORDER[i + 1] || "GRADUATED"); };

/** Where a promoted student goes: the next class, same arm when the school has it, else the first arm. */
export function promotionTarget(student, structure) {
  const to = nextClass(student.class);
  if (!to) return null;
  if (to === "GRADUATED") return { graduate: true };
  const arms = structure.classes.find((c) => c.name === to)?.arms || [];
  const arm = arms.includes(student.arm) ? student.arm : arms[0];
  return arm ? { class: to, arm, classKey: classKey(to, arm) } : null;
}

export function findDuplicates(existing, cand) {
  const n = normName(cand.name);
  return existing.filter((s) => !s.deleted && s.id !== cand.id && ((cand.admissionNo && s.admissionNo === cand.admissionNo) || (normName(s.name) === n && s.classKey === cand.classKey)));
}

export function makeAdmissionNo(taken, year = new Date().getFullYear()) {
  for (let i = 0; i < 50; i++) {
    const n = `${year}/${String(Math.floor(Math.random() * 90000) + 10000)}`;
    if (!taken.has(n)) return n;
  }
  return `${year}/${Date.now()}`;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
export function makeAccessCode(len = 10) {
  const b = new Uint32Array(len); crypto.getRandomValues(b);
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join("");
}

/** Which students show on registers and score sheets: active only (not left, graduated, deleted or pending). */
export const isEnrolled = (s) => !s.deleted && s.status === "active";

export function filterStudents(list, { q = "", cls = "", status = "active", showDeleted = false } = {}) {
  const needle = q.trim().toLowerCase();
  return list.filter((s) => (showDeleted ? s.deleted : !s.deleted)
    && (status === "all" || s.status === status)
    && (!cls || s.class === cls)
    && (!needle || s.name.toLowerCase().includes(needle) || String(s.admissionNo || "").toLowerCase().includes(needle)));
}

/** Parses a pasted list or CSV into student rows. Columns: name, gender (M/F), admission number (optional), repeater (R/yes, optional). */
export function parseStudentRows(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const cells = line.split(/[,\t;]/).map((x) => x.trim());
    const name = (cells[0] || "").replace(/^\d+[.)]\s*/, "");
    if (!name || /^(name|surname|full name)$/i.test(name)) continue;
    let gender = "", admissionNo = "", repeater = false;
    for (const c of cells.slice(1)) {
      const l = c.toLowerCase();
      if (l === "m" || l === "male") gender = "M";
      else if (l === "f" || l === "female") gender = "F";
      else if (l === "r" || l === "repeater" || l === "yes") repeater = true;
      else if (c) admissionNo = c;
    }
    out.push({ name: normName(name), gender, admissionNo, repeater });
  }
  return out;
}
