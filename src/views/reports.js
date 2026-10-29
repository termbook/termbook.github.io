import { h, mount, toast, empty, skeleton, confirmDialog, formDialog } from "../lib/dom.js";
import { state, roleOf } from "../lib/store.js";
import { studentsOnce, listSheets, allSheets, publishTerm, setPublished, loadTerm, exportCollection, loadRemarks, termId } from "../lib/data.js";
import { isEnrolled } from "../lib/students.js";
import { buildClassCards, ordinal } from "../lib/reportcard.js";
import { LBL } from "../lib/scores.js";
import { termSummary, todayStr, parseD, addDays, dstr } from "../lib/attendance.js";
import { classPicker, select, classLabel, friendlyAuthError } from "./common.js";
import { printNodes } from "./scores.js";
import { renderReportCard, remarksDialog, applyTemplatesDialog } from "./reportcard.js";

let unsub; export const stopReports = () => { unsub?.(); unsub = null; };

/** Opened / present counts per student for one class and term, from the attendance register (two marks per school day). */
async function attendanceFor(key, session, term, roster, termInfo, holidays) {
  if (!termInfo?.startDate) return {};
  const { getDocs, query, where, collection } = await import("firebase/firestore"); const { db } = await import("../lib/firebase.js");
  const snap = await getDocs(query(collection(db, `schools/${state.school.id}/attendance`), where("classKey", "==", key), where("session", "==", session), where("term", "==", term)));
  const att = {}; snap.docs.forEach((d) => (att[d.data().date] = d.data().marks || {}));
  const weeks = termInfo.weeks || 13; const end = dstr(addDays(parseD(termInfo.startDate), weeks * 7 - 1)); const today = todayStr() < end ? todayStr() : end;
  const sum = termSummary({ students: roster, attendance: att, holidays, termStart: termInfo.startDate, weeks, today, atRiskBelow: termInfo.atRisk || 75 });
  const out = {}; sum.rows.forEach((r) => (out[r.st.id] = { opened: sum.maxPts, present: r.pts })); return out;
}
async function holidayMap() { const m = {}; try { (await exportCollection("holidays")).forEach((d) => (m[d.id] = { label: d.reason })); } catch { /* none */ } return m; }

/** Builds the report cards for one class, or for every class when key is empty (admin publishing). */
export async function compileCards(key, term) {
  const s = state.school; const session = s.current.session;
  const [all, termInfo, holidays] = await Promise.all([studentsOnce(), loadTerm(session, term).catch(() => null), holidayMap()]);
  const roster = all.filter((x) => isEnrolled(x) && (!key || x.classKey === key));
  const sheets = key ? await listSheets(session, key) : await allSheets(session);
  const remarks = await loadRemarks(session, term, key || null).catch(() => ({}));
  const attendance = {}; for (const k of [...new Set(roster.map((x) => x.classKey))]) Object.assign(attendance, await attendanceFor(k, session, term, roster.filter((x) => x.classKey === k), termInfo, holidays));
  const cards = buildClassCards({ roster, sheets, term, session, school: { ...s, id: s.id }, nextTermBegins: termInfo?.nextTermBegins || "", attendance, remarks });
  return { cards, remarks, roster };
}

export async function reportsView(host) {
  stopReports(); const s = state.school, admin = roleOf() === "owner" || roleOf() === "admin"; const session = s.current.session;
  const ui = { key: admin ? "" : state.profile.classTeacherKey, term: s.current.term };
  if (!admin && !ui.key) return mount(host, h("h1", {}, "Report cards"), empty("Class teachers only", "Full-term report cards are available to the class teacher and the school admin."));
  const picker = admin ? classPicker(s.structure, "", { blank: "Choose a class" }) : null; const body = h("div", {});
  const termSel = select([["1", "1st term"], ["2", "2nd term"], ["3", "3rd term"]], String(ui.term), { "aria-label": "Term", onchange: (e) => { ui.term = +e.target.value; load(); } });
  if (picker) picker.addEventListener("change", () => { ui.key = picker.value; load(); });
  const termInfo = await loadTerm(session, s.current.term).catch(() => null); const pubBox = h("div", { class: "card" });
  const drawPub = (t) => mount(pubBox, h("h2", {}, "Publish results"), h("p", { class: "muted" }, t?.published ? `${LBL[s.current.term]} results are visible to parents.` : `${LBL[s.current.term]} results are hidden from parents until you publish.`),
    h("div", { class: "stack-row" }, h("button", { class: "btn btn-primary", onclick: publish }, t?.published ? "Republish with latest scores" : "Publish term results"), t?.published ? h("button", { class: "btn btn-danger-quiet", onclick: async () => { await setPublished(session, s.current.term, false); toast("Results hidden"); drawPub({ published: false }); } }, "Hide from parents") : null));
  async function publish(e) {
    if (!await confirmDialog({ title: `Publish ${LBL[s.current.term]} results?`, body: "Parents with a linked child will see each student's report card. Check that scores, conduct ratings, comments and the next term date are complete.", confirmLabel: "Publish" })) return;
    e.target.disabled = true;
    try {
      const { cards } = await compileCards("", s.current.term);
      const reports = cards.map((card) => ({ studentId: card.studentId, admissionNo: card.student.admissionNo, classKey: card.classKey, name: card.student.name, session, schoolName: s.name, card }));
      await publishTerm(session, s.current.term, reports, true); toast(`Published ${reports.length} report cards`); drawPub({ published: true });
    } catch (err) { toast(friendlyAuthError(err), "error"); e.target.disabled = false; }
  }
  mount(host, h("h1", {}, "Report cards"), admin ? pubBox : null, h("div", { class: "toolbar" }, picker, termSel), body);
  if (admin) drawPub(termInfo);
  const logos = { logo: s.branding?.logo || "", stateLogo: s.branding?.stateLogo || "" };
  const showCard = (card) => formDialog(card.student.name, (close) => h("div", {}, h("div", { class: "rc-scroll" }, renderReportCard(card, logos)), h("div", { class: "dlg-actions sticky" }, h("button", { class: "btn", onclick: () => close() }, "Close"), h("button", { class: "btn btn-primary", onclick: () => printNodes([renderReportCard(card, logos)]) }, "Print / save as PDF"))), true);
  const picked = new Set();
  async function load() {
    stopReports(); picked.clear(); if (!ui.key) return mount(body, empty("Choose a class", "Pick a class to see its report cards.")); mount(body, skeleton(4));
    try {
      const { cards, remarks, roster } = await compileCards(ui.key, ui.term); const byId = new Map(roster.map((x) => [x.id, x]));
      if (!cards.length) return mount(body, empty("No students", "Nothing to show yet."));
      const missing = cards.filter((c) => !c.affective.obtained).length;
      const targets = () => cards.map((c) => ({ student: byId.get(c.studentId), card: c, existing: remarks[c.studentId], selected: picked.has(c.studentId) }));
      const schoolWide = async () => { const all = await compileCards("", ui.term); const m = new Map(all.roster.map((x) => [x.id, x])); return all.cards.map((c) => ({ student: m.get(c.studentId), card: c, existing: all.remarks[c.studentId] })); };
      const count = h("span", { class: "muted" }, "0 ticked");
      const all = h("input", { type: "checkbox", "aria-label": "Tick all students", onchange: (e) => { document.querySelectorAll(".pick-row").forEach((x) => { x.checked = e.target.checked; x.dispatchEvent(new Event("change")); }); } });
      mount(body, h("div", { class: "toolbar" }, h("button", { class: "btn btn-primary", onclick: () => applyTemplatesDialog({ targets: targets(), selectedCount: picked.size, session, term: ui.term, school: s, loadSchoolWide: schoolWide, onDone: load }) }, "Apply templates"),
        h("button", { class: "btn", onclick: () => printNodes(cards.map((c) => renderReportCard(c, logos))) }, "Print all report cards")),
        missing ? h("p", { class: "banner banner-info" }, `${missing} student${missing === 1 ? " has" : "s have"} no conduct ratings yet. Use "Apply templates" to fill the class, or open "Conduct and comments" for each student.`) : null,
        h("div", { class: "toolbar" }, h("label", { class: "chk" }, all, "Tick all"), count),
        h("div", { class: "list" }, cards.map((c) => h("div", { class: "row-card" }, h("label", { class: "chk" }, h("input", { type: "checkbox", class: "pick-row", "aria-label": `Tick ${c.student.name}`, onchange: (e) => { e.target.checked ? picked.add(c.studentId) : picked.delete(c.studentId); count.textContent = `${picked.size} ticked`; } })),
          h("div", { class: "grow" }, h("strong", {}, c.student.name), h("div", { class: "hint" }, c.counts.offered ? `${c.totals.percent}% · position ${ordinal(c.counts.position)} of ${c.counts.classSize}` : "No scores yet", c.affective.obtained ? ` · conduct ${c.affective.obtained}/${c.affective.total}` : " · no conduct ratings")),
          h("div", { class: "stack-row" }, h("button", { class: "btn btn-sm", onclick: () => remarksDialog({ student: byId.get(c.studentId), card: c, existing: remarks[c.studentId], session, term: ui.term, school: s, onSaved: load }) }, "Conduct and comments"), h("button", { class: "btn btn-sm btn-primary", onclick: () => showCard(c) }, "View card"))))));
    } catch (e) { mount(body, empty("Cannot load report cards", friendlyAuthError(e))); }
  }
  load();
}
export { termId };
