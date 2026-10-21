import { h, mount, toast, empty, skeleton, confirmDialog } from "../lib/dom.js";
import { state, roleOf } from "../lib/store.js";
import { watchStudents, listSheets, allSheets, publishTerm, setPublished, loadTerm, exportCollection } from "../lib/data.js";
import { isEnrolled } from "../lib/students.js";
import { buildReports } from "../lib/reports.js";
import { LBL, ord } from "../lib/scores.js";
import { termSummary, todayStr, sortStudents } from "../lib/attendance.js";
import { classPicker, select, classLabel, friendlyAuthError } from "./common.js";
import { printNodes } from "./scores.js";

let unsub; export const stopReports = () => { unsub?.(); unsub = null; };

export function reportCard(r, school, session) {
  return h("article", { class: "report" }, h("h2", {}, school?.name || r.schoolName || ""), h("p", {}, `${r.class}${r.arm} · ${LBL[r.term]} · ${session}`), h("h3", {}, r.name),
    h("table", {}, h("thead", {}, h("tr", {}, ["Subject", "1st CA", "2nd CA", "Open day", "Exam", "Total", "Grade", "Position"].map((x) => h("th", {}, x)))),
      h("tbody", {}, r.subjects.map((s) => h("tr", {}, h("th", {}, s.subject), [s.a, s.b, s.c, s.ex, s.t, s.grade, `${ord(s.pos)} of ${s.of}`].map((v) => h("td", {}, v)))))),
    h("p", {}, r.subjects.length ? `Total ${r.total} · Average ${r.average}${r.position ? ` · Class position ${ord(r.position)} of ${r.classSize}` : ""}` : "No scores yet."),
    r.attendance ? h("p", {}, `Attendance: ${r.attendance.present} of ${r.attendance.max} marks (${r.attendance.pct}%) over ${r.attendance.days} school days`) : null);
}

export async function reportsView(host) {
  stopReports(); const s = state.school, admin = roleOf() === "owner" || roleOf() === "admin"; const session = s.current.session;
  const ui = { key: admin ? "" : state.profile.classTeacherKey, term: s.current.term };
  if (!admin && !ui.key) return mount(host, h("h1", {}, "Report cards"), empty("Class teachers only", "Full-term report cards are available to the class teacher and the school admin."));
  const picker = admin ? classPicker(s.structure, "", { blank: "Choose a class" }) : null; const body = h("div", {});
  const termSel = select([["1", "1st term"], ["2", "2nd term"], ["3", "3rd term"]], String(ui.term), { "aria-label": "Term", onchange: (e) => { ui.term = +e.target.value; load(); } });
  if (picker) picker.addEventListener("change", () => { ui.key = picker.value; load(); });
  const termInfo = await loadTerm(session, s.current.term).catch(() => null);
  const pubBox = h("div", { class: "card" });
  const drawPub = (t) => mount(pubBox, h("h2", {}, "Publish results"), h("p", { class: "muted" }, t?.published ? `${LBL[s.current.term]} results are visible to parents.` : `${LBL[s.current.term]} results are hidden from parents until you publish.`),
    h("div", { class: "stack-row" }, h("button", { class: "btn btn-primary", onclick: publish }, t?.published ? "Republish with latest scores" : "Publish term results"), t?.published ? h("button", { class: "btn btn-danger-quiet", onclick: async () => { await setPublished(session, s.current.term, false); toast("Results hidden"); drawPub({ published: false }); } }, "Hide from parents") : null));
  async function publish(e) {
    if (!await confirmDialog({ title: `Publish ${LBL[s.current.term]} results?`, body: "Parents with a linked child will see the results and attendance summary. Make sure scores are complete.", confirmLabel: "Publish" })) return;
    e.target.disabled = true;
    try {
      const students = await new Promise((res) => { const un = watchStudents((l) => { un(); res(l || []); }); }); const roster = students.filter(isEnrolled);
      const sheets = await allSheets(session); const t = await loadTerm(session, s.current.term); const attendance = {};
      if (t?.startDate) { const { getDocs, query, where, collection } = await import("firebase/firestore"); const { db } = await import("../lib/firebase.js"); const keys = [...new Set(roster.map((x) => x.classKey))];
        const hol = {}; (await exportCollection("holidays")).forEach((d) => (hol[d.id] = { label: d.reason }));
        for (const k of keys) { const snap = await getDocs(query(collection(db, `schools/${state.school.id}/attendance`), where("classKey", "==", k), where("session", "==", session), where("term", "==", s.current.term))); const att = {}; snap.docs.forEach((d) => (att[d.data().date] = d.data().marks || {}));
          const cls = roster.filter((x) => x.classKey === k); const sum = termSummary({ students: cls, attendance: att, holidays: hol, termStart: t.startDate, weeks: t.weeks || 13, today: todayStr(), atRiskBelow: t.atRisk || 75 });
          sum.rows.forEach((r) => (attendance[r.st.id] = { present: r.pts, max: sum.maxPts, days: sum.schoolDays, pct: Math.round(r.pct) })); } }
      const reports = buildReports({ roster, sheets, term: s.current.term, weights: s.scoring.weights, grades: s.scoring.grades, attendance }).map((r) => ({ ...r, session, schoolName: s.name }));
      await publishTerm(session, s.current.term, reports, true); toast(`Published ${reports.length} report cards`); drawPub({ published: true });
    } catch (err) { toast(friendlyAuthError(err), "error"); e.target.disabled = false; }
  }
  mount(host, h("h1", {}, "Report cards"), admin ? pubBox : null, h("div", { class: "toolbar" }, picker, termSel), body);
  if (admin) drawPub(termInfo);
  async function load() {
    stopReports(); if (!ui.key) return mount(body, empty("Choose a class", "Pick a class to see its combined report cards.")); mount(body, skeleton(4));
    try {
      const sheets = await listSheets(session, ui.key);
      unsub = watchStudents((l) => { const roster = (l || []).filter((x) => x.classKey === ui.key && isEnrolled(x)); const reports = buildReports({ roster, sheets, term: ui.term, weights: s.scoring.weights, grades: s.scoring.grades }).sort((a, b) => a.name.localeCompare(b.name));
        mount(body, reports.length ? [h("div", { class: "toolbar" }, h("button", { class: "btn", onclick: () => printNodes(reports.map((r) => reportCard(r, s, session))) }, "Print all report cards")), h("div", { class: "list" }, reports.map((r) => h("div", { class: "row-card" }, h("div", {}, h("strong", {}, r.name), h("div", { class: "hint" }, r.average === null ? "No scores yet" : `Average ${r.average}${r.position ? ` · ${ord(r.position)} of ${r.classSize}` : ""}`)), h("button", { class: "btn btn-sm", onclick: () => printNodes([reportCard(r, s, session)]) }, "Print"))))] : empty("No students", "Nothing to show yet.")); });
    } catch (e) { mount(body, empty("Cannot load report cards", friendlyAuthError(e))); }
  }
  load();
}
