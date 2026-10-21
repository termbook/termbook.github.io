import { h, mount, toast, empty, skeleton, field, initials, formDialog } from "../lib/dom.js";
import { state, roleOf } from "../lib/store.js";
import { watchStudents, loadSheet, saveCell, saveSheetFlag, sheetId } from "../lib/data.js";
import { isEnrolled, classKey } from "../lib/students.js";
import { calc, annual, rankOf, termStats, grade, ord, LBL, sheetRows, groups, num } from "../lib/scores.js";
import { toSheetModel } from "../lib/reports.js";
import { select, classLabel, friendlyAuthError } from "./common.js";

let unsub = null; export const stopScores = () => { unsub?.(); unsub = null; };
const FIELDS = [["a", "1st CA", "a"], ["b", "2nd CA", "b"], ["c", "Open day", "c"], ["e", "Exam", "e"]]; const BONUS = [["at", "Attendance"], ["tb", "Textbook"], ["nb", "Notebook"]];

/** Printable report for one student in one subject. Shared by the Report links and "Print all reports". */
export function subjectReport(c, sid, school, w, grades, session) {
  const name = c.students[sid].n; const an = annual(c, sid, w);
  return h("article", { class: "report" }, h("h2", {}, school.name), h("p", {}, `${c.subject} · ${c.cls} · ${session}`), h("h3", {}, name),
    h("table", {}, h("thead", {}, h("tr", {}, ["Term", "1st CA", "2nd CA", "Open day", "Exam", "Total", "Grade", "Position"].map((x) => h("th", {}, x)))),
      h("tbody", {}, ["1", "2", "3"].map((t) => { const x = an.t[t]; const p = rankOf(c, t, sid, w); return h("tr", {}, h("th", {}, LBL[t]), x ? [x.a, x.b, x.c, x.ex, x.t, grade(x.t, grades), p ? `${ord(p.p)} of ${p.n}` : ""].map((v) => h("td", {}, v)) : h("td", { colspan: 7, class: "muted" }, "Not scored")); }))),
    h("p", {}, an.n ? `Annual total ${an.sum} · Average ${an.avg}` : "No scores yet."));
}
export function printNodes(nodes) { let a = document.getElementById("print-area"); if (!a) { a = h("div", { id: "print-area" }); document.body.append(a); } a.replaceChildren(...nodes); window.print(); }

export async function scoresView(host) {
  stopScores(); const s = state.school, admin = roleOf() === "owner" || roleOf() === "admin"; const w = s.scoring.weights, grades = s.scoring.grades, session = s.current.session;
  let options = [];
  if (admin) options = s.structure.classes.flatMap((c) => c.arms.flatMap((a) => s.structure.subjects.map((sub) => ({ subject: sub, key: classKey(c.name, a) }))));
  else options = (state.profile.assignmentsList || []).map((a) => ({ subject: a.subject, key: classKey(a.class, a.arm) }));
  if (!options.length) return mount(host, h("h1", {}, "Scores"), empty("No subjects assigned", "Your school admin has not given you a subject and class yet."));
  const stored = localStorage.getItem("tb-sheet"); let cur = options.find((o) => `${o.subject}@@${o.key}` === stored) || options[0];
  const ui = { tab: "scores", term: s.current.term, q: "" }; const body = h("div", {}); let roster = null, sheet = null; const saved = h("span", { class: "chip", role: "status" }, "Saved ✓");
  const sel = select(options.map((o) => [`${o.subject}@@${o.key}`, `${classLabel(o.key)} ${o.subject}`]), `${cur.subject}@@${cur.key}`, { "aria-label": "Class and subject", onchange: (e) => { cur = options.find((o) => `${o.subject}@@${o.key}` === e.target.value); localStorage.setItem("tb-sheet", e.target.value); open(); } });
  const tabs = h("div", { class: "subtabs", role: "tablist" }, [["scores", "Scores"], ["students", "Students"], ["class", "Class"]].map(([id, l]) => h("button", { class: "tabbtn", role: "tab", "aria-selected": String(ui.tab === id), onclick: () => { ui.tab = id; tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.textContent === l))); draw(); } }, l)));
  mount(host, h("div", { class: "toolbar sticky" }, sel, saved), tabs, body);
  const model = () => ({ ...toSheetModel(sheet || { subject: cur.subject, scores: {} }, roster), cls: classLabel(cur.key), teacher: sheet?.teacher || state.profile?.name || "", bonus: sheet?.bonus !== false });
  async function open() {
    mount(body, skeleton(5)); roster = null; unsub?.(); sheet = await loadSheet(session, cur.subject, cur.key).catch(() => null);
    unsub = watchStudents((l) => { roster = (l || []).filter((x) => x.classKey === cur.key && isEnrolled(x)); draw(); });
  }
  function draw() {
    if (!roster) return; if (!roster.length) return mount(body, empty("No students in this class", "Students appear here once they are active in this class and arm."));
    if (ui.tab === "scores") return scoresTab(); if (ui.tab === "students") return studentsTab(); return classTab();
  }
  const touched = new Map();
  function scoresTab() {
    const c = model(); const st = termStats(c, ui.term, w); const q = ui.q.toLowerCase(); const term = String(ui.term);
    const inputsFor = (stu, chipEl) => {
      const mk = (k, label, max) => { const v = c.scores?.[term]?.[stu.id]?.[k]; const i = h("input", { type: "number", inputmode: "decimal", min: 0, max, step: "any", value: v ?? "", id: `${stu.id}-${k}`, "data-s": stu.id, "data-k": k, "aria-label": `${stu.n} ${label} out of ${max}` });
        i.addEventListener("input", () => { let val = i.value; if (val !== "") { const n = Math.min(max, Math.max(0, +val)); if (n !== +val) { val = String(n); i.value = val; } } const row = ((sheet ||= { subject: cur.subject, scores: {} }).scores[term] ||= {}); const r = (row[stu.id] ||= {}); if (val === "") delete r[k]; else r[k] = +val; if (!Object.keys(r).length) delete row[stu.id]; refreshChip(stu.id, chipEl); queueSave(stu.id, k, val); });
        i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const all = [...body.querySelectorAll(`input[data-k="${k}"]`)]; (all[all.indexOf(i) + 1] || all[0]).focus(); } });
        return h("label", { class: "sc" }, h("span", {}, `${label} /${max}`), i); };
      return h("div", {}, h("div", { class: "scgrid" }, FIELDS.map(([k, l]) => mk(k, l, w[k === "e" ? "e" : k]))), h("div", { class: "scgrid three" }, BONUS.map(([k, l]) => mk(k, l, w[k]))));
    };
    const refreshChip = (id, el) => { const x = calc(model(), ui.term, id, w); el.textContent = x ? x.t : "–"; el.className = "chip " + (x ? "chip-ok" : ""); const pr = body.querySelector("#prog"); if (pr) pr.textContent = `${termStats(model(), ui.term, w).scored} of ${st.total} students scored`; };
    const card = (stu) => { const x = calc(c, ui.term, stu.id, w); const chip = h("span", { class: "chip " + (x ? "chip-ok" : "") }, x ? x.t : "–");
      return h("div", { class: "sc-card" }, h("div", { class: "sc-head" }, h("span", { class: "avatar", "aria-hidden": "true" }, initials(stu.n)), h("strong", {}, stu.n), stu.r ? h("span", { class: "tag tag-warn" }, "Repeater") : null, chip), h("button", { class: "linkbtn", onclick: () => formDialog(stu.n, (close) => h("div", {}, subjectReport(model(), stu.id, s, w, grades, session), h("div", { class: "dlg-actions" }, h("button", { class: "btn", onclick: () => close() }, "Close"), h("button", { class: "btn btn-primary", onclick: () => printNodes([subjectReport(model(), stu.id, s, w, grades, session)]) }, "Print")))) }, "Report"), inputsFor(stu, chip)); };
    const grp = groups(c).map(([label, list]) => { const vis = list.filter((x) => !q || x.n.toLowerCase().includes(q)); return vis.length ? [h("h2", {}, `${label.toUpperCase()} (${list.length})`), h("div", { class: "sc-grid" }, vis.map(card))] : null; });
    mount(body, h("div", { class: "term-tabs", role: "tablist" }, [1, 2, 3].map((t) => h("button", { role: "tab", "aria-selected": String(ui.term === t), onclick: () => { ui.term = t; scoresTab(); } }, LBL[t]))),
      h("div", { class: "filters" }, h("input", { type: "search", placeholder: "Find a student", "aria-label": "Find a student", value: ui.q, oninput: (e) => { ui.q = e.target.value; const p = e.target.selectionStart; scoresTab(); const n = body.querySelector("input[type=search]"); n.focus(); n.setSelectionRange(p, p); } }),
        h("label", { class: "chk" }, h("input", { type: "checkbox", checked: c.bonus, onchange: async (e) => { (sheet ||= { subject: cur.subject, scores: {} }).bonus = e.target.checked; scoresTab(); try { await saveSheetFlag(session, cur.subject, cur.key, { bonus: e.target.checked }); } catch (err) { toast(friendlyAuthError(err), "error"); } } }), "Add bonus marks to exam")),
      h("p", { id: "prog", class: "card" }, `${st.scored} of ${st.total} students scored`), grp);
  }
  const pending = new Map(); let t;
  function queueSave(sid, k, val) { pending.set(`${ui.term}|${sid}|${k}`, val); saved.textContent = "Saving…"; clearTimeout(t); t = setTimeout(flush, 600); }
  async function flush() { const items = [...pending.entries()]; pending.clear(); try { for (const [key, val] of items) { const [tm, sid, k] = key.split("|"); await saveCell(session, cur.subject, cur.key, { teacher: state.profile?.name }, tm, sid, k, val === "" ? "" : +val); } saved.textContent = navigator.onLine ? "Saved ✓" : "Saved on this device"; } catch (e) { saved.textContent = "Not saved"; toast(friendlyAuthError(e), "error"); } }
  function studentsTab() {
    const c = model(); mount(body, h("div", { class: "toolbar" }, h("button", { class: "btn", onclick: () => printNodes(c ? Object.keys(c.students).sort((a, b) => c.students[a].n.localeCompare(c.students[b].n)).map((id) => subjectReport(c, id, s, w, grades, session)) : []) }, "Print all reports")),
      h("p", { class: "muted" }, "Students come from your school's register. The class teacher or admin adds, edits and sets gender under Students."),
      groups(c).map(([label, list]) => [h("h2", {}, `${label.toUpperCase()} (${list.length})`), h("div", { class: "list" }, list.map((x) => h("div", { class: "row-card" }, h("div", {}, h("strong", {}, x.n), x.r ? h("span", { class: "tag tag-warn" }, "Repeater") : null), h("button", { class: "btn btn-sm", onclick: () => formDialog(x.n, (close) => h("div", {}, subjectReport(c, x.id, s, w, grades, session), h("div", { class: "dlg-actions" }, h("button", { class: "btn", onclick: () => close() }, "Close"), h("button", { class: "btn btn-primary", onclick: () => printNodes([subjectReport(c, x.id, s, w, grades, session)]) }, "Print")))) }, "Report"))))]));
  }
  function classTab() {
    const c = model(); mount(body, h("div", { class: "card" }, field("Subject", h("input", { value: cur.subject, disabled: true })), field("Class", h("input", { value: classLabel(cur.key), disabled: true })), field("Teacher", h("input", { value: c.teacher, disabled: true })),
      h("div", { class: "stack-row" }, h("button", { class: "btn btn-primary", onclick: async (e) => { e.target.disabled = true; try { const XLSX = await import("xlsx"); const { rows, merges } = sheetRows(c, w); const ws = XLSX.utils.aoa_to_sheet(rows); ws["!merges"] = merges; const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Scoresheet"); XLSX.writeFile(wb, `${classLabel(cur.key)}_${cur.subject.replace(/\W+/g, "_")}.xlsx`); } catch (err) { toast(friendlyAuthError(err), "error"); } e.target.disabled = false; } }, "Export to Excel"),
        h("button", { class: "btn", onclick: () => printNodes(Object.keys(c.students).sort((a, b) => c.students[a].n.localeCompare(c.students[b].n)).map((id) => subjectReport(c, id, s, w, grades, session))) }, "Print all reports")),
      h("p", { class: "hint" }, "To delete this sheet's scores, ask your school admin.")));
  }
  open();
}
