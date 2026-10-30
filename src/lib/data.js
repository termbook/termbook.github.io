/** All Firestore reads and writes live here, so screens stay simple and every change can be audited. */
import { db, auth } from "./firebase.js";
import { state, effectiveSchoolId } from "./store.js";
import { classKey } from "./students.js";
import { DEFAULT_WEIGHTS, DEFAULT_GRADES } from "./scores.js";
import { DEFAULT_SUBJECTS_BY_LEVEL, unionSubjects } from "./structure.js";
import {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, getDocs, query, where, onSnapshot, writeBatch, serverTimestamp, orderBy, FieldPath, deleteField,
} from "firebase/firestore";

const sp = (path = "") => `schools/${effectiveSchoolId()}${path ? "/" + path : ""}`;
export const col = (path) => collection(db, path);
export const ref = (path) => doc(db, path);

export const DEFAULT_STRUCTURE = {
  classes: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"].map((name) => ({ name, arms: [] })), // add arms (A, B, C...) in Setup if a class has them
  departments: ["Science", "Arts", "Commercial", "Technical"],
  subjectsByLevel: DEFAULT_SUBJECTS_BY_LEVEL,
  subjects: unionSubjects(DEFAULT_SUBJECTS_BY_LEVEL),
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
  if ((patch.structure || patch.branding || patch.name) && state.school.status === "verified") {
    const pub = {}; if (patch.name) pub.name = patch.name; if (patch.structure) pub.structure = patch.structure; if (patch.branding) pub.branding = { logo: patch.branding.logo || "", stateLogo: patch.branding.stateLogo || "" };
    await updateDoc(ref(`publicSchools/${effectiveSchoolId()}`), pub).catch(() => {});
  }
  await audit("school_settings", sp(), Object.keys(patch));
}

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
/** Reads the student list once (the live listener is closed after the first answer, even if it answers immediately). */
export function studentsOnce() { return new Promise((resolve, reject) => { let un = null, done = false; un = watchStudents((list, err) => { if (done) return; done = true; if (un) un(); if (err) reject(err); else resolve(list || []); }); if (done && un) un(); }); }
export async function addStudent(s, priv) {
  const r = doc(db, sp(`students/${studentIdFor(s.admissionNo)}`));
  if ((await getDoc(r)).exists()) throw new Error("That admission number is already in use.");
  const b = writeBatch(db);
  b.set(r, { ...s, classKey: classKey(s.class, s.arm), deleted: false, schoolId: effectiveSchoolId(), createdAt: serverTimestamp() });
  if (priv && Object.values(priv).some(Boolean)) b.set(doc(db, `${r.path}/private/info`), priv);
  await b.commit(); await audit("student_add", r.id, { name: s.name }); return r.id;
}
export async function addStudents(list) {
  for (let i = 0; i < list.length; i += 100) {
    const b = writeBatch(db);
    for (const { _priv, ...s } of list.slice(i, i + 100)) {
      const r = doc(db, sp(`students/${studentIdFor(s.admissionNo)}`));
      b.set(r, { ...s, classKey: classKey(s.class, s.arm), deleted: false, schoolId: effectiveSchoolId(), createdAt: serverTimestamp() });
      if (_priv && Object.values(_priv).some(Boolean)) b.set(doc(db, `${r.path}/private/info`), _priv);
    }
    await b.commit();
  }
  await audit("student_bulk_add", sp("students"), { count: list.length });
}
export async function updateStudent(id, patch, priv, before = {}) {
  const b = writeBatch(db);
  const full = { ...patch, updatedAt: serverTimestamp() }; if (patch.class && patch.arm) full.classKey = classKey(patch.class, patch.arm);
  const admChanged = patch.admissionNo !== undefined && patch.admissionNo !== before.admissionNo;
  if (admChanged) {
    // The record id stays the same so attendance, scores and parent links keep working. An index maps the new number to it.
    const newKey = studentIdFor(patch.admissionNo); const isAdminRole = state.isOwner || state.profile?.role === "admin";
    if (newKey !== id) {
      const ix = await getDoc(ref(sp(`admissionIndex/${newKey}`)));
      if (ix.exists() && ix.data().studentId !== id) throw new Error("That admission number is already in use.");
      if (isAdminRole && (await getDoc(ref(sp(`students/${newKey}`)))).exists()) throw new Error("That admission number is already in use.");
      if (!ix.exists()) b.set(ref(sp(`admissionIndex/${newKey}`)), { studentId: id });
    }
    const oldKey = studentIdFor(before.admissionNo); if (oldKey !== id) b.delete(ref(sp(`admissionIndex/${oldKey}`)));
  }
  b.update(ref(sp(`students/${id}`)), full);
  if (priv) b.set(ref(sp(`students/${id}/private/info`)), priv, { merge: true });
  await b.commit();
  const changed = Object.keys(patch).filter((k) => before[k] !== undefined && before[k] !== patch[k]);
  await audit("student_edit", id, { fields: changed, ...(changed.includes("name") ? { nameFrom: before.name, nameTo: patch.name } : {}), ...(admChanged ? { admissionFrom: before.admissionNo, admissionTo: patch.admissionNo } : {}) });
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
  const uid = auth.currentUser.uid; let studentId = studentIdFor(admissionNo);
  // If the school corrected this admission number, the index points to the student's real record id.
  try { const ix = await getDoc(doc(db, `schools/${schoolId}/admissionIndex/${studentId}`)); if (ix.exists()) studentId = ix.data().studentId; } catch { /* no index: the number was never changed */ }
  await setDoc(doc(db, `schools/${schoolId}/links/${uid}_${studentId}`), { uid, studentId, admissionNo, code, createdAt: serverTimestamp() });
  const me = await getDoc(ref(`users/${uid}`)); const links = (me.data()?.links || []).filter((l) => !(l.schoolId === schoolId && l.studentId === studentId));
  links.push({ schoolId, studentId, admissionNo }); await updateDoc(ref(`users/${uid}`), { links });
  return links;
}

// ---- attendance ----
const attId = (key, date) => `${key.replace("|", "-")}_${date}`;
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

// ---- report card remarks (conduct ratings and comments) ----
export async function saveRemarks(session, term, student, patch) {
  const tid = termId(session, term);
  await setDoc(ref(sp(`remarks/${tid}_${student.id}`)), { studentId: student.id, classKey: student.classKey, termId: tid, session, term, ...patch, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid }, { merge: true });
  await audit("report_remarks", student.id, { term: tid });
}
export async function loadRemarks(session, term, key) {
  const tid = termId(session, term); const q = key ? query(col(sp("remarks")), where("termId", "==", tid), where("classKey", "==", key)) : query(col(sp("remarks")), where("termId", "==", tid));
  const s = await getDocs(q); const m = {}; s.docs.forEach((x) => (m[x.data().studentId] = x.data())); return m;
}
/** The school's public logos, for parents' report cards. */
export async function publicSchoolBranding(schoolId) { try { const s = await getDoc(ref(`publicSchools/${schoolId}`)); return s.exists() ? { name: s.data().name || "", logo: s.data().branding?.logo || "", stateLogo: s.data().branding?.stateLogo || "" } : {}; } catch { return {}; } }

/** Writes conduct ratings and comments for many students at once. items: [{ student, patch }]. */
export async function saveRemarksBulk(session, term, items) {
  const tid = termId(session, term);
  for (let i = 0; i < items.length; i += 100) {
    const b = writeBatch(db);
    for (const { student, patch } of items.slice(i, i + 100)) b.set(ref(sp(`remarks/${tid}_${student.id}`)), { studentId: student.id, classKey: student.classKey, termId: tid, session, term, ...patch, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid }, { merge: true });
    await b.commit();
  }
  await audit("report_remarks_bulk", sp("remarks"), { term: tid, students: items.length });
}

// ---- student attendance records (what a parent sees) and absence notes ----
export const attRecId = (session, studentId) => `${session.replace("/", "-")}_${studentId}`;
export const marksMask = (m) => (m && m.morning ? 1 : 0) | (m && m.afternoon ? 2 : 0);
/** Keeps each changed student's own attendance record in step with the class register. changes: [{ student, mask }] */
export async function syncStudentAttendance({ session, term, key, date, changes, openDays }) {
  for (let i = 0; i < changes.length; i += 100) {
    const b = writeBatch(db);
    for (const { studentId, mask } of changes.slice(i, i + 100)) b.set(ref(sp(`studentAttendance/${attRecId(session, studentId)}`)), { studentId, classKey: key, session, d: { [date]: mask ? mask : deleteField() }, od: { [term]: openDays }, updatedAt: serverTimestamp() }, { merge: true });
    await b.commit();
  }
}
export async function loadStudentAttendance(schoolId, session, studentId) { try { const s = await getDoc(doc(db, `schools/${schoolId}/studentAttendance/${attRecId(session, studentId)}`)); return s.exists() ? s.data() : null; } catch { return null; } }
export async function saveAbsenceNote(schoolId, student, date, reason) { await setDoc(doc(db, `schools/${schoolId}/absenceNotes/${student.id}_${date}`), { studentId: student.id, classKey: student.classKey, date, reason, uid: auth.currentUser.uid, createdAt: serverTimestamp() }); }
export async function loadMyAbsenceNotes(schoolId, studentId) { try { const s = await getDocs(query(collection(db, `schools/${schoolId}/absenceNotes`), where("uid", "==", auth.currentUser.uid), where("studentId", "==", studentId))); return s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => b.date.localeCompare(a.date)); } catch { return []; } }
export async function deleteAbsenceNote(schoolId, id) { await deleteDoc(doc(db, `schools/${schoolId}/absenceNotes/${id}`)); }
export function watchAbsenceNotes(key, cb) { return onSnapshot(query(col(sp("absenceNotes")), where("classKey", "==", key)), (s) => { const m = {}; s.docs.forEach((x) => (m[`${x.data().studentId}_${x.data().date}`] = x.data())); cb(m); }, () => cb({})); }
/** Used by a linked parent to read and edit their own child's private details. */
export async function loadPrivateFor(schoolId, studentId) { try { const s = await getDoc(doc(db, `schools/${schoolId}/students/${studentId}/private/info`)); return s.exists() ? s.data() : {}; } catch { return {}; } }
export async function saveParentPrivate(schoolId, studentId, values) { await setDoc(doc(db, `schools/${schoolId}/students/${studentId}/private/info`), { ...values, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid, updatedByRole: "parent" }, { merge: true }); }
/** One-off repair for the admin: rebuilds every student's attendance record for a session from the class registers. */
export async function rebuildStudentAttendance(session, students, termDays) {
  const snap = await getDocs(query(col(sp("attendance")), where("session", "==", session)));
  const per = {}; snap.docs.forEach((x) => { const r = x.data(); Object.entries(r.marks || {}).forEach(([sid, m]) => { const mask = marksMask(m); if (mask) ((per[sid] ||= {})[r.date] = mask); }); });
  const list = students.filter((s) => !s.deleted); let n = 0;
  for (let i = 0; i < list.length; i += 100) {
    const b = writeBatch(db);
    for (const s of list.slice(i, i + 100)) { b.set(ref(sp(`studentAttendance/${attRecId(session, s.id)}`)), { studentId: s.id, classKey: s.classKey, session, d: per[s.id] || {}, od: termDays, updatedAt: serverTimestamp() }); n++; }
    await b.commit();
  }
  await audit("attendance_rebuilt", sp("studentAttendance"), { students: n }); return n;
}

// ---- owner: replacing a school's admin ----
const usersWhere = async (...conds) => { const s = await getDocs(query(col("users"), ...conds)); return s.docs.map((x) => ({ id: x.id, ...x.data() })); };
export const adminsOf = (schoolId) => usersWhere(where("schoolId", "==", schoolId), where("role", "==", "admin"));
export const teachersOfSchool = (schoolId) => usersWhere(where("schoolId", "==", schoolId), where("role", "==", "teacher"));
export const findTeacherByEmail = (email) => usersWhere(where("email", "==", String(email).trim().toLowerCase()), where("role", "==", "teacher"));
/**
 * Makes a registered teacher the school's admin. The old admin either loses access or becomes a teacher waiting for the new admin's approval.
 * oldAction: "remove" | "teacher".
 */
export async function replaceAdmin(school, newUser, oldAdmins, oldAction) {
  const b = writeBatch(db); const clear = { classKeys: [], assignments: [], assignmentsList: [], classTeacherKey: null, classTeacher: null };
  b.update(ref(`users/${newUser.id}`), { role: "admin", schoolId: school.id, status: "active", ...clear, updatedAt: serverTimestamp() });
  for (const o of oldAdmins.filter((x) => x.id !== newUser.id)) b.update(ref(`users/${o.id}`), oldAction === "teacher" ? { role: "teacher", status: "pending", ...clear, requested: { classTeacher: null, assignments: [] }, updatedAt: serverTimestamp() } : { status: "removed", updatedAt: serverTimestamp() });
  b.update(ref(`schools/${school.id}`), { adminUid: newUser.id });
  await b.commit();
  state.schoolId = school.id; await audit("admin_replaced", school.id, { to: newUser.email || newUser.id, from: oldAdmins.map((o) => o.email || o.id), oldAction }); state.schoolId = null;
}
