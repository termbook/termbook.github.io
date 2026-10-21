/** All Firestore reads and writes live here, so screens stay simple and every change can be audited. */
import { db, auth } from "./firebase.js";
import { state, effectiveSchoolId } from "./store.js";
import { classKey } from "./students.js";
import { DEFAULT_WEIGHTS, DEFAULT_GRADES } from "./scores.js";
import {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, getDocs, query, where, onSnapshot, writeBatch, serverTimestamp, orderBy, FieldPath, deleteField,
} from "firebase/firestore";

const sp = (path = "") => `schools/${effectiveSchoolId()}${path ? "/" + path : ""}`;
export const col = (path) => collection(db, path);
export const ref = (path) => doc(db, path);

export const DEFAULT_STRUCTURE = {
  classes: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"].map((name) => ({ name, arms: ["A", "B"] })),
  departments: ["Science", "Arts", "Commercial"],
  subjects: ["English Language", "Mathematics", "Basic Science", "Basic Technology", "Social Studies", "Civic Education", "Computer Studies", "Agricultural Science", "Business Studies", "Christian Religious Studies", "Islamic Religious Studies", "Physical and Health Education", "Cultural and Creative Arts", "Yoruba", "Igbo", "Hausa", "French", "Biology", "Chemistry", "Physics", "Further Mathematics", "Economics", "Government", "Literature in English", "Geography", "Accounting", "Commerce"],
};
export const DEFAULT_SCORING = { weights: DEFAULT_WEIGHTS, grades: DEFAULT_GRADES };
export const DEFAULT_SETTINGS = { atRisk: 75, weeks: 13 };

// ---- audit ----
export async function audit(action, target, detail = {}) {
  const p = state.profile;
  await addDoc(col("audit"), {
    schoolId: effectiveSchoolId(), uid: auth.currentUser.uid, name: p?.name || (state.isOwner ? "Owner" : ""), role: state.isOwner ? "owner" : p?.role,
    byOwner: state.isOwner, action, target, detail: JSON.stringify(detail).slice(0, 900), at: serverTimestamp(),
  }).catch(() => {});
}

// ---- profile and registration ----
export async function loadProfile(uid) { const s = await getDoc(ref(`users/${uid}`)); return s.exists() ? s.data() : null; }
export async function tryBootstrapOwner(user) {
  try { await setDoc(ref(`users/${user.uid}`), { uid: user.uid, role: "owner", status: "active", email: user.email, name: user.displayName || "Owner", createdAt: serverTimestamp() }); return true; } catch { return false; }
}
export async function loadSchool(id) { const s = await getDoc(ref(`schools/${id}`)); return s.exists() ? { id, ...s.data() } : null; }
export async function getPlatform() { try { const s = await getDoc(ref("config/platform")); return s.exists() ? s.data() : { requireVerification: true }; } catch { return { requireVerification: true }; } }

export async function registerAdmin({ user, admin, school, consent }) {
  const platform = await getPlatform();
  const schoolRef = doc(col("schools"));
  const status = platform.requireVerification === false ? "verified" : "pending";
  const b = writeBatch(db);
  b.set(schoolRef, { ...school, status, adminUid: user.uid, structure: DEFAULT_STRUCTURE, scoring: DEFAULT_SCORING, settings: DEFAULT_SETTINGS, current: { session: currentSessionLabel(), term: 1 }, createdAt: serverTimestamp() });
  b.set(ref(`users/${user.uid}`), { uid: user.uid, role: "admin", status: "active", schoolId: schoolRef.id, email: user.email, ...admin, consent, createdAt: serverTimestamp() });
  await b.commit();
  if (status === "verified") await setDoc(ref(`publicSchools/${schoolRef.id}`), { name: school.name, state: school.state, lga: school.lga, structure: DEFAULT_STRUCTURE });
  return schoolRef.id;
}
export function currentSessionLabel() { const d = new Date(); const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return `${y}/${y + 1}`; }

export async function registerTeacher({ user, teacher, schoolId, requested, consent }) {
  await setDoc(ref(`users/${user.uid}`), { uid: user.uid, role: "teacher", status: "pending", schoolId, email: user.email, ...teacher, requested, classKeys: [], assignments: [], classTeacherKey: null, consent, createdAt: serverTimestamp() });
}
export async function registerParent({ user, name, phone, consent }) {
  await setDoc(ref(`users/${user.uid}`), { uid: user.uid, role: "parent", status: "active", email: user.email, name, phone, consent, createdAt: serverTimestamp() });
}
export async function publicSchools() { const s = await getDocs(col("publicSchools")); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }

// ---- owner ----
export async function ownerSchools() { const s = await getDocs(col("schools")); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }
export async function ownerSetSchoolStatus(school, status) {
  await updateDoc(ref(`schools/${school.id}`), { status });
  if (status === "verified") await setDoc(ref(`publicSchools/${school.id}`), { name: school.name, state: school.state, lga: school.lga, structure: school.structure || DEFAULT_STRUCTURE });
  else await deleteDoc(ref(`publicSchools/${school.id}`)).catch(() => {});
  state.schoolId = school.id; await audit(`school_${status}`, school.id, { name: school.name }); state.schoolId = null;
}
export async function setPlatform(data) { await setDoc(ref("config/platform"), data, { merge: true }); await audit("platform_settings", "config/platform", data); }
export async function loadAudit(schoolId, n = 100) {
  const q = schoolId ? query(col("audit"), where("schoolId", "==", schoolId), orderBy("at", "desc")) : query(col("audit"), orderBy("at", "desc"));
  const s = await getDocs(q); return s.docs.slice(0, n).map((d) => ({ id: d.id, ...d.data() }));
}
export async function nationalHolidays() { try { const s = await getDoc(ref("config/holidays")); return s.exists() ? s.data().list || [] : []; } catch { return []; } }
export async function saveNationalHolidays(list) { await setDoc(ref("config/holidays"), { list }); await audit("national_holidays", "config/holidays", { count: list.length }); }

// ---- school settings ----
export async function saveSchool(patch) {
  await updateDoc(ref(sp()), patch); state.school = { ...state.school, ...patch };
  if (patch.structure && state.school.status === "verified") await updateDoc(ref(`publicSchools/${effectiveSchoolId()}`), { name: state.school.name, state: state.school.state, lga: state.school.lga, structure: patch.structure }).catch(() => {}); await audit("school_settings", sp(), Object.keys(patch)); }

// ---- students ----
/** Live list of every student in the school (admin/owner) or of the teacher's classes. Returns an unsubscribe function. */
export function watchStudents(cb) {
  const u = state.profile;
  const base = col(sp("students"));
  const onErr = (e) => cb(null, e);
  const map = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (state.isOwner || u.role === "admin") return onSnapshot(base, (s) => cb(map(s)), onErr);
  const keys = u.classKeys || []; const parts = {}; const unsubs = [];
  if (!keys.length) { cb([]); return () => {}; }
  for (const k of keys) unsubs.push(onSnapshot(query(base, where("classKey", "==", k)), (s) => { parts[k] = map(s); cb(Object.values(parts).flat()); }, onErr));
  return () => unsubs.forEach((f) => f());
}
/** Student document ids come from the admission number, so a parent can find the child's record and numbers stay unique. */
export const studentIdFor = (adm) => String(adm).trim().replace(/[\/\s.#$\[\]]+/g, "-");
export async function addStudent(s, priv) {
  const r = doc(db, sp(`students/${studentIdFor(s.admissionNo)}`));
  if ((await getDoc(r)).exists()) throw new Error("That admission number is already in use.");
  const b = writeBatch(db);
  b.set(r, { ...s, classKey: classKey(s.class, s.arm), deleted: false, schoolId: effectiveSchoolId(), createdAt: serverTimestamp() });
  if (priv && Object.values(priv).some(Boolean)) b.set(doc(db, `${r.path}/private/info`), priv);
  await b.commit(); await audit("student_add", r.id, { name: s.name }); return r.id;
}
export async function addStudents(list) {
  for (let i = 0; i < list.length; i += 200) {
    const b = writeBatch(db);
    for (const s of list.slice(i, i + 200)) b.set(doc(db, sp(`students/${studentIdFor(s.admissionNo)}`)), { ...s, classKey: classKey(s.class, s.arm), deleted: false, schoolId: effectiveSchoolId(), createdAt: serverTimestamp() });
    await b.commit();
  }
  await audit("student_bulk_add", sp("students"), { count: list.length });
}
export async function updateStudent(id, patch, priv) {
  const b = writeBatch(db);
  const full = { ...patch }; if (patch.class && patch.arm) full.classKey = classKey(patch.class, patch.arm);
  b.update(ref(sp(`students/${id}`)), full);
  if (priv) b.set(ref(sp(`students/${id}/private/info`)), priv, { merge: true });
  await b.commit();
}
/** Bulk change for the admin/owner: promote, move, mark as left, graduate, reactivate, remove (soft-delete) or restore. */
export async function bulkStudentAction(ids, action, payload = {}, list = []) {
  const byId = new Map(list.map((s) => [s.id, s]));
  for (let i = 0; i < ids.length; i += 200) {
    const b = writeBatch(db);
    for (const id of ids.slice(i, i + 200)) {
      const p = { updatedAt: serverTimestamp() };
      if (action === "promote") { const t = payload.targets[id]; if (!t) continue; if (t.graduate) { p.status = "graduated"; p.graduatedOn = payload.date; } else { p.class = t.class; p.arm = t.arm; p.classKey = t.classKey; } }
      else if (action === "move") { p.class = payload.class; p.arm = payload.arm; p.classKey = classKey(payload.class, payload.arm); }
      else if (action === "left") { p.status = "left"; p.leftReason = payload.reason; p.leftOn = payload.date; }
      else if (action === "reactivate") { p.status = "active"; p.leftReason = ""; p.leftOn = ""; }
      else if (action === "approve") { p.status = "active"; }
      else if (action === "remove") { p.deleted = true; p.deletedOn = payload.date; }
      else if (action === "restore") { p.deleted = false; }
      b.update(ref(sp(`students/${id}`)), p);
    }
    await b.commit();
  }
  await audit(`students_${action}`, sp("students"), { count: ids.length, ...payload, targets: undefined, names: ids.slice(0, 5).map((id) => byId.get(id)?.name) });
}
export async function loadPrivate(id) { try { const s = await getDoc(ref(sp(`students/${id}/private/info`))); return s.exists() ? s.data() : {}; } catch { return {}; } }

// ---- teachers ----
export async function listTeachers() { const s = await getDocs(query(col("users"), where("schoolId", "==", effectiveSchoolId()), where("role", "==", "teacher"))); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }
/** Approve or update a teacher. assignments: [{subject, class, arm}], classTeacher: {class, arm} | null. */
export async function setTeacher(uid, { status, classTeacher, assignments }) {
  const classKeys = new Set(); (assignments || []).forEach((a) => classKeys.add(classKey(a.class, a.arm)));
  const ct = classTeacher ? classKey(classTeacher.class, classTeacher.arm) : null; if (ct) classKeys.add(ct);
  await updateDoc(ref(`users/${uid}`), { status, classTeacherKey: ct, classTeacher: classTeacher || null, assignmentsList: assignments || [], assignments: (assignments || []).map((a) => `${a.subject}|${classKey(a.class, a.arm)}`), classKeys: [...classKeys] });
  await audit("teacher_update", `users/${uid}`, { status, classTeacher: ct, count: (assignments || []).length });
}

// ---- access codes and links ----
export async function issueAccessCode(student, code) {
  await setDoc(ref(sp(`accessCodes/${student.id}`)), { code, active: true, studentId: student.id, issuedAt: serverTimestamp() });
  await audit("access_code_issued", student.id, {});
}
export async function revokeAccess(student) {
  await updateDoc(ref(sp(`accessCodes/${student.id}`)), { active: false }).catch(() => {});
  const links = await getDocs(query(col(sp("links")), where("studentId", "==", student.id)));
  await Promise.all(links.docs.map((d) => deleteDoc(d.ref)));
  await audit("access_revoked", student.id, { links: links.size });
}
export async function loadAccessCode(studentId) { const s = await getDoc(ref(sp(`accessCodes/${studentId}`))); return s.exists() ? s.data() : null; }
/** Parent links a child. The rules compare the code on the server; the code is never readable by the parent. */
export async function linkChild({ schoolId, admissionNo, code, childName }) {
  const uid = auth.currentUser.uid; const studentId = studentIdFor(admissionNo);
  await setDoc(doc(db, `schools/${schoolId}/links/${uid}_${studentId}`), { uid, studentId, admissionNo, code, createdAt: serverTimestamp() });
  const me = await getDoc(ref(`users/${uid}`)); const links = (me.data()?.links || []).filter((l) => !(l.schoolId === schoolId && l.studentId === studentId));
  links.push({ schoolId, studentId, admissionNo }); await updateDoc(ref(`users/${uid}`), { links });
  return links;
}

// ---- attendance ----
const attId = (key, date) => `${key.replace(/\|/g, "-")}_${date}`;
export function watchAttendance(key, from, to, cb) {
  return onSnapshot(query(col(sp("attendance")), where("classKey", "==", key), where("date", ">=", from), where("date", "<=", to)), (s) => {
    const m = {}; s.docs.forEach((d) => { const x = d.data(); m[x.date] = x.marks || {}; }); cb(m);
  }, () => cb(null));
}
export async function saveAttendanceDay(key, date, marks, meta) {
  await setDoc(ref(sp(`attendance/${attId(key, date)}`)), { classKey: key, date, marks, ...meta, schoolId: effectiveSchoolId(), updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
}
export function watchHolidays(cb) { return onSnapshot(col(sp("holidays")), (s) => { const m = {}; s.docs.forEach((d) => (m[d.id] = { label: d.data().reason || "" })); cb(m); }, () => cb({})); }
export async function addHoliday(date, reason) { await setDoc(ref(sp(`holidays/${date}`)), { reason: reason || "" }); await audit("holiday_add", date, { reason }); }
export async function removeHoliday(date) { await deleteDoc(ref(sp(`holidays/${date}`))); await audit("holiday_remove", date, {}); }

// ---- terms ----
export const termId = (session, term) => `${session.replace("/", "-")}_${term}`;
export async function loadTerm(session, term) { const s = await getDoc(ref(sp(`terms/${termId(session, term)}`))); return s.exists() ? s.data() : null; }
export async function saveTerm(session, term, data) { await setDoc(ref(sp(`terms/${termId(session, term)}`)), { session, term, ...data }, { merge: true }); await audit("term_settings", termId(session, term), data); }

// ---- score sheets ----
export const sheetId = (session, subject, key) => `${session.replace("/", "-")}__${subject.replace(/[^A-Za-z0-9]+/g, "_")}__${key.replace("|", "-")}`;
export async function loadSheet(session, subject, key) { const s = await getDoc(ref(sp(`sheets/${sheetId(session, subject, key)}`))); return s.exists() ? s.data() : null; }
const sheetReady = new Set();
/** Saves one score cell. Empty values are removed, so "not entered" stays different from zero. */
export async function saveCell(session, subject, key, meta, term, sid, field, value) {
  const id = sheetId(session, subject, key); const r = ref(sp(`sheets/${id}`));
  if (!sheetReady.has(id)) { const s = await getDoc(r); if (!s.exists()) await setDoc(r, { subject, classKey: key, session, schoolId: effectiveSchoolId(), bonus: true, scores: {}, teacher: meta.teacher || "", createdAt: serverTimestamp() }); sheetReady.add(id); }
  await updateDoc(r, new FieldPath("scores", String(term), sid, field), value === "" ? deleteField() : value, "updatedAt", serverTimestamp());
}
export async function saveSheetFlag(session, subject, key, patch) { await updateDoc(ref(sp(`sheets/${sheetId(session, subject, key)}`)), patch).catch(async () => { await setDoc(ref(sp(`sheets/${sheetId(session, subject, key)}`)), { subject, classKey: key, session, schoolId: effectiveSchoolId(), scores: {}, bonus: true, ...patch }, { merge: true }); }); }
export async function listSheets(session, key) { const s = await getDocs(query(col(sp("sheets")), where("classKey", "==", key), where("session", "==", session))); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }
export async function allSheets(session) { const s = await getDocs(query(col(sp("sheets")), where("session", "==", session))); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }

// ---- reports ----
export async function publishTerm(session, term, reports, published = true) {
  const tid = termId(session, term);
  for (let i = 0; i < reports.length; i += 200) {
    const b = writeBatch(db);
    reports.slice(i, i + 200).forEach((r) => b.set(ref(sp(`reports/${tid}_${r.studentId}`)), { ...r, termId: tid, schoolId: effectiveSchoolId() }));
    await b.commit();
  }
  await setDoc(ref(sp(`terms/${tid}`)), { session, term, published, publishedAt: serverTimestamp() }, { merge: true });
  await audit(published ? "term_published" : "term_unpublished", tid, { reports: reports.length });
}
export async function setPublished(session, term, published) { await setDoc(ref(sp(`terms/${termId(session, term)}`)), { session, term, published }, { merge: true }); await audit(published ? "term_published" : "term_unpublished", termId(session, term), {}); }
export async function loadReport(schoolId, tid, studentId) { const s = await getDoc(doc(db, `schools/${schoolId}/reports/${tid}_${studentId}`)); return s.exists() ? s.data() : null; }
export async function myChild(schoolId, link) { const s = await getDoc(doc(db, `schools/${schoolId}/students/${link.studentId}`)); return s.exists() ? { id: s.id, ...s.data() } : null; }
export async function reportsForStudent(schoolId, studentId, tids) { const out = []; for (const t of tids) { try { const r = await loadReport(schoolId, t, studentId); if (r) out.push(r); } catch { /* not published */ } } return out; }

// ---- backup ----
export async function exportCollection(name) { const s = await getDocs(col(sp(name))); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }
