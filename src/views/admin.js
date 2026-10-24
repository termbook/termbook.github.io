import { h, mount, toast, confirmDialog, formDialog, field, empty, skeleton } from "../lib/dom.js";
import { state, roleOf, effectiveSchoolId } from "../lib/store.js";
import { listTeachers, setTeacher, saveSchool, loadTerm, saveTerm, nationalHolidays, addHoliday, watchStudents, exportCollection, currentSessionLabel, bulkStudentAction, termId } from "../lib/data.js";
import { input, select, rolePicker, classLabel, friendlyAuthError } from "./common.js";
import { showDate, parseShown } from "../lib/dates.js";
import { promotionTarget } from "../lib/students.js";
import { subjectsByLevel, unionSubjects } from "../lib/structure.js";
import { DEFAULT_GRADES, DEFAULT_WEIGHTS } from "../lib/scores.js";

export async function overviewView(host) {
  mount(host, h("h1", {}, "Overview"), skeleton(3));
  const s = state.school; let teachers = []; try { teachers = await listTeachers(); } catch { /* offline */ }
  const pending = teachers.filter((t) => t.status === "pending").length;
  const un = watchStudents((list) => {
    un(); if (!list) return;
    const act = list.filter((x) => !x.deleted && x.status === "active").length, pend = list.filter((x) => !x.deleted && x.status === "pending").length;
    const card = (v, l, href) => h("a", { class: "stat", href }, h("div", { class: "v" }, v), h("div", { class: "l" }, l));
    mount(host, h("h1", {}, s.name),
      s.status === "pending" ? h("p", { class: "banner banner-warn" }, "Your school is waiting for verification by the platform owner. You can set up classes and students now. Teachers can find your school after it is verified.") : null,
      s.status === "rejected" ? h("p", { class: "banner banner-error" }, "Your school was not verified. Contact the platform owner.") : null,
      h("div", { class: "stats" }, card(act, "Active students", "#/admin/students"), card(pend, "Students to confirm", "#/admin/students"), card(pending, "Teachers waiting", "#/admin/teachers"), card(`${s.current.session} · Term ${s.current.term}`, "Current term", "#/admin/setup")));
  });
}

export async function teachersView(host) {
  mount(host, h("h1", {}, "Teachers"), skeleton(4));
  const structure = state.school.structure;
  let list; try { list = await listTeachers(); } catch (e) { return mount(host, h("h1", {}, "Teachers"), empty("Cannot load teachers", friendlyAuthError(e))); }
  const draw = () => {
    const group = (st, title) => { const l = list.filter((t) => t.status === st); return l.length ? [h("h2", {}, `${title} (${l.length})`), h("div", { class: "list" }, l.map((t) => h("div", { class: "row-card" }, h("div", {}, h("strong", {}, t.name), h("div", { class: "hint" }, `${t.email} · ${t.phone}`), summary(t)), h("button", { class: "btn btn-sm", type: "button", onclick: () => review(t) }, st === "pending" ? "Review" : "Edit")))) ] : null; };
    mount(host, h("h1", {}, "Teachers"), list.length ? [group("pending", "Waiting for approval"), group("active", "Approved"), group("rejected", "Not approved"), group("suspended", "Suspended")] : empty("No teachers yet", "Teachers who register under your school appear here for approval."));
  };
  const summary = (t) => { const ct = t.classTeacherKey ? `Class teacher: ${classLabel(t.classTeacherKey)}` : t.requested?.classTeacher ? `Asked to be class teacher: ${t.requested.classTeacher.class}${t.requested.classTeacher.arm}` : ""; const subs = (t.assignmentsList || t.requested?.assignments || []); const names = [...new Set(subs.map((a) => a.subject))]; return h("div", { class: "hint" }, [ct, names.length ? `Subjects: ${names.join(", ")}` : ""].filter(Boolean).join(" · ")); };
  function review(t) {
    const init = t.status === "pending" ? t.requested || {} : { classTeacher: t.classTeacher, assignments: t.assignmentsList };
    const rp = rolePicker(structure, init); const out = h("p", { class: "form-msg error", hidden: true });
    const save = async (status, close) => { const r = rp.get(); if (status === "active" && !r.classTeacher && !r.assignments.length) { out.textContent = "Give this teacher at least one role."; out.hidden = false; return; } try { await setTeacher(t.id, { status, ...(status === "active" ? r : { classTeacher: null, assignments: [] }) }); Object.assign(t, { status }); close("ok"); list = await listTeachers(); draw(); toast("Saved"); } catch (e) { out.textContent = friendlyAuthError(e); out.hidden = false; } };
    formDialog(t.name, (close) => h("div", {}, h("p", { class: "hint" }, `${t.email} · ${t.phone}`), rp.el, out,
      h("div", { class: "dlg-actions" }, h("button", { class: "btn", onclick: () => close("no") }, "Close"),
        t.status === "active" ? h("button", { class: "btn btn-danger-quiet", onclick: () => save("suspended", close) }, "Suspend") : h("button", { class: "btn btn-danger-quiet", onclick: () => save("rejected", close) }, "Reject"),
        h("button", { class: "btn btn-primary", onclick: () => save("active", close) }, t.status === "active" ? "Save roles" : "Approve"))));
  }
  draw();
}

const lines = (t) => t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

export async function setupView(host) {
  const s = state.school; const owner = roleOf() === "owner";
  const term = await loadTerm(s.current.session, s.current.term).catch(() => null) || {};
  const out = (el) => { el.className = "form-msg ok"; el.textContent = "Saved."; el.hidden = false; };
  // --- structure
  const classBoxes = s.structure.classes.map((c) => ({ name: c.name, arms: input({ value: c.arms.join(", "), "aria-label": `${c.name} arms` }) }));
  const sbl = subjectsByLevel(s.structure); const subjJ = h("textarea", { rows: 8, "aria-label": "JSS subjects" }, sbl.JSS.join("\n")); const subjS = h("textarea", { rows: 8, "aria-label": "SS subjects" }, sbl.SS.join("\n")); const dept = input({ value: s.structure.departments.join(", ") });
  const stMsg = h("p", { hidden: true, role: "status" });
  const structureCard = h("section", { class: "card" }, h("h2", {}, "Classes, arms and subjects"), h("p", { class: "muted" }, "Edit these before teachers register, so they can pick from your school's own list. Separate arms with commas (A, B, C)."),
    classBoxes.map((c) => field(c.name + " arms", c.arms)), field("SS departments (comma separated)", dept), field("JSS subjects (JSS1 to JSS3), one per line", subjJ), field("SS subjects (SS1 to SS3), one per line", subjS, "A subject taught at both levels goes in both lists."), stMsg,
    h("button", { class: "btn btn-primary", type: "button", onclick: async () => { const classes = classBoxes.map((c) => ({ name: c.name, arms: c.arms.value.split(",").map((x) => x.trim()).filter(Boolean) })); if (classes.some((c) => !c.arms.length)) { stMsg.className = "form-msg error"; stMsg.textContent = "Every class needs at least one arm."; stMsg.hidden = false; return; } try { await saveSchool({ structure: { classes, departments: dept.value.split(",").map((x) => x.trim()).filter(Boolean), subjectsByLevel: { JSS: [...new Set(lines(subjJ.value))], SS: [...new Set(lines(subjS.value))] }, subjects: unionSubjects({ JSS: lines(subjJ.value), SS: lines(subjS.value) }) } }); out(stMsg); } catch (e) { stMsg.className = "form-msg error"; stMsg.textContent = friendlyAuthError(e); stMsg.hidden = false; } } }, "Save"));
  // --- term
  const sess = input({ value: s.current.session }); const tn = select([["1", "1st term"], ["2", "2nd term"], ["3", "3rd term"]], String(s.current.term));
  const start = input({ placeholder: "DD/MM/YYYY (a Monday)", value: showDate(term.startDate) }); const weeks = input({ type: "number", value: term.weeks || s.settings.weeks, min: 1, max: 20 }); const risk = input({ type: "number", value: term.atRisk || s.settings.atRisk, min: 1, max: 100 });
  const tMsg = h("p", { hidden: true, role: "status" });
  const termCard = h("section", { class: "card" }, h("h2", {}, "Session and term"), h("p", { class: "muted" }, "Weekends are never school days. Holidays are set under Attendance."),
    field("Session", sess, "Example: 2026/2027"), field("Term", tn), field("Term start date (a Monday)", start), field("Weeks in the term", weeks), field("At-risk below (%)", risk), tMsg,
    h("div", { class: "stack-row" }, h("button", { class: "btn btn-primary", type: "button", onclick: async () => { const d = parseShown(start.value); if (!/^\d{4}\/\d{4}$/.test(sess.value)) return fail(tMsg, "Session must look like 2026/2027."); if (!d) return fail(tMsg, "Enter the start date as DD/MM/YYYY."); if (new Date(d + "T00:00:00").getDay() !== 1) return fail(tMsg, "The term must start on a Monday."); try { await saveSchool({ current: { session: sess.value, term: +tn.value } }); await saveTerm(sess.value, +tn.value, { startDate: d, weeks: +weeks.value, atRisk: +risk.value }); out(tMsg); } catch (e) { fail(tMsg, friendlyAuthError(e)); } } }, "Save term"),
      h("button", { class: "btn", type: "button", onclick: newTermFlow }, "Start next term")));
  function fail(el, t) { el.className = "form-msg error"; el.textContent = t; el.hidden = false; }
  async function newTermFlow() {
    const cur = s.current; const nextT = cur.term === 3 ? 1 : cur.term + 1; const [y] = cur.session.split("/").map(Number); const nextS = cur.term === 3 ? `${y + 1}/${y + 2}` : cur.session;
    const promote = cur.term === 3;
    if (!await confirmDialog({ title: `Start ${nextT === 1 ? "1st" : nextT === 2 ? "2nd" : "3rd"} term, ${nextS}?`, body: `Past attendance, scores and reports stay in the history.${promote ? " After this you can promote all active students to the next class." : ""} Set the new term's start date afterwards.`, confirmLabel: "Start term" })) return;
    try { await saveSchool({ current: { session: nextS, term: nextT } }); toast("New term started. Set its start date."); if (promote && await confirmDialog({ title: "Promote all active students now?", body: "Each moves up one class (SS3 become Graduated). You can also do this later from Students.", confirmLabel: "Promote all" })) {
      const un = watchStudents(async (list) => { un(); const act = list.filter((x) => !x.deleted && x.status === "active"); const targets = {}; act.forEach((x) => { const t = promotionTarget(x, s.structure); if (t) targets[x.id] = t; }); await bulkStudentAction(Object.keys(targets), "promote", { targets, date: new Date().toISOString().slice(0, 10) }, act); toast("Students promoted"); }); }
      setupView(host); } catch (e) { toast(friendlyAuthError(e), "error"); }
  }
  // --- scoring
  const w = s.scoring.weights; const wf = { a: input({ type: "number", value: w.a }), b: input({ type: "number", value: w.b }), c: input({ type: "number", value: w.c }), e: input({ type: "number", value: w.e }), at: input({ type: "number", value: w.at }), tb: input({ type: "number", value: w.tb }), nb: input({ type: "number", value: w.nb }) };
  const gr = h("textarea", { rows: 6, "aria-label": "Grade boundaries" }, s.scoring.grades.map((g) => `${g.min} ${g.g}`).join("\n")); const scMsg = h("p", { hidden: true, role: "status" });
  const scoringCard = h("section", { class: "card" }, h("h2", {}, "Scoring"), h("p", { class: "muted" }, "Change these before scoring starts. Defaults are 10 / 10 / 10 / 70 with three /5 bonus marks added to the exam."),
    field("1st CA out of", wf.a), field("2nd CA out of", wf.b), field("Open day out of", wf.c), field("Exam out of", wf.e), field("Attendance bonus out of", wf.at), field("Textbook bonus out of", wf.tb), field("Notebook bonus out of", wf.nb),
    field("Grade boundaries (lowest mark, then grade, one per line)", gr, "Example: 70 A"), scMsg,
    h("div", { class: "stack-row" }, h("button", { class: "btn btn-primary", type: "button", onclick: async () => { const weights = Object.fromEntries(Object.entries(wf).map(([k, v]) => [k, Math.max(0, +v.value || 0)])); if (weights.a + weights.b + weights.c + weights.e !== 100) return fail(scMsg, "The four main marks should add up to 100."); const grades = lines(gr.value).map((l) => { const [m, ...g] = l.split(/\s+/); return { min: +m, g: g.join(" ") }; }); if (grades.some((g) => !Number.isFinite(g.min) || !g.g)) return fail(scMsg, "Each grade line needs a number and a grade, like: 70 A"); grades.sort((p, q) => q.min - p.min); if (grades[grades.length - 1].min !== 0) return fail(scMsg, "The lowest grade must start at 0."); try { await saveSchool({ scoring: { weights, grades } }); out(scMsg); } catch (e) { fail(scMsg, friendlyAuthError(e)); } } }, "Save scoring"),
      h("button", { class: "btn", type: "button", onclick: () => { Object.entries(DEFAULT_WEIGHTS).forEach(([k, v]) => (wf[k].value = v)); gr.value = DEFAULT_GRADES.map((g) => `${g.min} ${g.g}`).join("\n"); } }, "Reset to defaults")));
  // --- backup
  const bkMsg = h("p", { hidden: true, role: "status" });
  const backupCard = h("section", { class: "card" }, h("h2", {}, "Backup"), h("p", { class: "muted" }, "Download everything for this school as an Excel workbook: students, teachers, attendance and score sheets."), bkMsg,
    h("button", { class: "btn", type: "button", onclick: async (e) => { e.target.disabled = true; try { const XLSX = await import("xlsx"); const wb = XLSX.utils.book_new(); const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: "empty" }]), name);
      const students = await exportCollection("students"); add("Students", students.map((x) => ({ id: x.id, name: x.name, gender: x.gender, class: x.class, arm: x.arm, admissionNo: x.admissionNo, status: x.status, removed: x.deleted ? "yes" : "", repeater: x.repeater ? "yes" : "", dob: x.dob })));
      const t = await listTeachers(); add("Teachers", t.map((x) => ({ name: x.name, email: x.email, phone: x.phone, status: x.status, classTeacher: x.classTeacherKey || "", subjects: (x.assignments || []).join("; ") })));
      const att = await exportCollection("attendance"); add("Attendance", att.flatMap((d) => Object.entries(d.marks || {}).map(([sid, m]) => ({ date: d.date, class: d.classKey, studentId: sid, AM: m.morning ? 1 : 0, PM: m.afternoon ? 1 : 0 }))));
      const sheets = await exportCollection("sheets"); add("Scores", sheets.flatMap((sh) => Object.entries(sh.scores || {}).flatMap(([tm, byS]) => Object.entries(byS).map(([sid, r]) => ({ session: sh.session, term: tm, class: sh.classKey, subject: sh.subject, studentId: sid, ...r })))));
      XLSX.writeFile(wb, `${s.name.replace(/\W+/g, "_")}_backup_${new Date().toISOString().slice(0, 10)}.xlsx`); bkMsg.hidden = true; } catch (err) { fail(bkMsg, friendlyAuthError(err)); } e.target.disabled = false; } }, "Download backup (Excel)"));
  mount(host, h("h1", {}, "Setup"), h("div", { class: "cards" }, structureCard, termCard, scoringCard, backupCard));
}
