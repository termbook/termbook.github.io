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

/** Splits one CSV/TSV line, honouring double quotes. */
function splitLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === "," || ch === "\t" || ch === ";") { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim()); return out;
}
const HEADERS = [["name", /^(full ?name|name|surname|student( name)?)$/i], ["gender", /^(gender|sex)$/i], ["class", /^class$/i], ["arm", /^arm$/i], ["admissionNo", /^(admission( no\.?| number)?|adm\.? ?no\.?)$/i],
  ["repeater", /^repeater$/i], ["dob", /^(date of birth|dob|birth ?date)$/i], ["status", /^status$/i], ["parentName", /^(parent|guardian|parent\/guardian|parent or guardian)( name)?$/i],
  ["address", /^address$/i], ["phone", /^(parent'?s? )?(phone|phone number|mobile|parent phone( number)?|guardian phone)$/i]];
const toIsoDate = (v) => { const t = String(v || "").trim(); let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? t : ""; };
const toPhone = (v) => { const d = String(v || "").replace(/[\s-]/g, ""); if (/^[789][01]\d{8}$/.test(d)) return "0" + d; return /^(0[789][01]\d{8}|\+234[789][01]\d{8})$/.test(d) ? d : ""; };

/**
 * Parses a pasted list or CSV into student rows.
 * With a header row (Name, Gender, Class, Arm, Admission no., Repeater, Date of birth, Parent name, Address, Phone) columns are matched by name.
 * Without one: name first, then gender (M/F), an admission number and R for repeater in any order.
 */
export function parseStudentRows(text) {
  return parseStudentTable(String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim()).map(splitLine));
}

/** Same as parseStudentRows but for rows already split into cells (CSV or Excel files). */
export function parseStudentTable(table) {
  const out = []; let map = null; let first = true;
  for (const cells0 of table) {
    const cells = cells0.map((c) => String(c ?? "").trim()); if (!cells.some(Boolean)) continue; const i = first ? 0 : 1; first = false;
    if (i === 0 && cells.some((c) => HEADERS[0][1].test(c)) && cells.length > 1) { map = {}; cells.forEach((c, idx) => { const h = HEADERS.find(([, re]) => re.test(c.trim())); if (h && !(h[0] in map)) map[h[0]] = idx; }); continue; }
    if (map) {
      const g = (k) => (map[k] === undefined ? "" : cells[map[k]] || "");
      const name = normName(g("name").replace(/^\d+[.)]\s*/, "")); if (!name) continue;
      const gl = g("gender").toLowerCase(); const rep = g("repeater").toLowerCase();
      out.push({ name, gender: gl.startsWith("m") ? "M" : gl.startsWith("f") ? "F" : "", admissionNo: g("admissionNo"), repeater: ["r", "yes", "y", "repeater", "true"].includes(rep),
        class: g("class").toUpperCase().replace(/\s+/g, ""), arm: g("arm").trim(), dob: toIsoDate(g("dob")), dobBad: Boolean(g("dob")) && !toIsoDate(g("dob")), parentName: g("parentName"), address: g("address"), phone: toPhone(g("phone")), phoneBad: Boolean(g("phone")) && !toPhone(g("phone")) });
      continue;
    }
    const name = (cells[0] || "").replace(/^\d+[.)]\s*/, ""); if (!name) continue;
    let gender = "", admissionNo = "", repeater = false;
    for (const c of cells.slice(1)) { const l = c.toLowerCase(); if (l === "m" || l === "male") gender = "M"; else if (l === "f" || l === "female") gender = "F"; else if (l === "r" || l === "repeater" || l === "yes") repeater = true; else if (c) admissionNo = c; }
    out.push({ name: normName(name), gender, admissionNo, repeater });
  }
  return out;
}

/** Reads an uploaded .csv/.txt (as text, so dates stay exactly as typed) or .xlsx/.xls (through SheetJS) into table rows. */
export async function readStudentFile(file) {
  const name = file.name.toLowerCase(); const buf = await file.arrayBuffer();
  if (/\.(xlsx|xls)$/.test(name)) {
    const XLSX = await import("xlsx"); const wb = XLSX.read(buf, { type: "array", cellDates: true }); const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    return rows.map((r) => r.map((v) => (v instanceof Date ? new Date(v.getTime() + 12 * 3600e3).toISOString().slice(0, 10) : v)));
  }
  let text; try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { text = new TextDecoder("windows-1252").decode(buf); }
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim()).map(splitLine);
}

/** Column headings of the downloadable students template. Keep in step with the import reader above. */
export const TEMPLATE_HEADERS = ["Name", "Gender", "Class", "Arm", "Admission no.", "Repeater", "Date of birth", "Parent/guardian name", "Address", "Parent phone"];
