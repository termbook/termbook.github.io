import { h, mount, toast, empty, skeleton, field, initials, formDialog, downloadCsv } from "../lib/dom.js";
import { state, roleOf } from "../lib/store.js";
import { watchStudents, loadSheet, saveCell, saveSheetFlag, sheetId } from "../lib/data.js";
import { isEnrolled, classKey } from "../lib/students.js";
import { calc, annual, rankOf, termStats, grade, ord, LBL, sheetRows, groups, students } from "../lib/scores.js";
import { toSheetModel } from "../lib/reports.js";
import { select, classLabel, friendlyAuthError } from "./common.js";
import { subjectsForClass } from "../lib/structure.js";

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
  if (admin) options = s.structure.classes.flatMap((c) => c.arms.flatMap((a) => subjectsForClass(s.structure, c.name).map((sub) => ({ subject: sub, key: classKey(c.name, a) }))));
  else options = (state.profile.assignmentsList || []).map((a) => ({ subject: a.subject, key: classKey(a.class, a.arm) }));
  if (!options.length) return mount(host, h("h1", {}, "Scores"), empty("No subjects assigned", "Your school admin has not given you a subject and class yet."));
  const stored = localStorage.getItem("tb-sheet"); let cur = options.find((o) => `${o.subject}@@${o.key}` === stored) || options[0];
  const ui = { tab: "scores", term: s.current.term, q: "", sex: "all", todo: false, view: "term" }; const body = h("div", {}); let roster = null, sheet = null; const saved = h("span", { class: "chip", role: "status" }, "Saved ✓");
  const sel = select(options.map((o) => [`${o.subject}@@${o.key}`, `${classLabel(o.key)} ${o.subject}`]), `${cur.subject}@@${cur.key}`, { "aria-label": "Class and subject", onchange: (e) => { cur = options.find((o) => `${o.subject}@@${o.key}` === e.target.value); localStorage.setItem("tb-sheet", e.target.value); open(); } });
  const tabs = h("div", { class: "subtabs", role: "tablist" }, [["scores", "Scores"], ["results", "Results"], ["students", "Students"], ["class", "Class"]].map(([id, l]) => h("button", { class: "tabbtn", role: "tab", "aria-selected": String(ui.tab === id), onclick: () => { ui.tab = id; tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.textContent === l))); draw(); } }, l)));
  mount(host, h("div", { class: "toolbar" }, sel, saved), tabs, body);
  const model = () => ({ ...toSheetModel(sheet || { subject: cur.subject, scores: {} }, roster), cls: classLabel(cur.key), teacher: sheet?.teacher || state.profile?.name || "", bonus: sheet?.bonus !== false });
  async function open() {
    mount(body, skeleton(5)); roster = null; unsub?.(); sheet = await loadSheet(session, cur.subject, cur.key).catch(() => null);
    unsub = watchStudents((l) => { roster = (l || []).filter((x) => x.classKey === cur.key && isEnrolled(x)); draw(); });
  }
  function draw() {
    if (!roster) return; if (!roster.length) return mount(body, empty("No students in this class", "Students appear here once they are active in this class and arm."));
    if (ui.tab === "scores") return scoresTab(); if (ui.tab === "results") return resultsTab(); if (ui.tab === "students") return studentsTab(); return classTab();
  }
    const COLS = [["a", "1st CA"], ["b", "2nd CA"], ["c", "Open day"], ["e", "Exam"], ["at", "Attendance"], ["tb", "Textbook"], ["nb", "Notebook"]];
  const gcls = (g) => `g-${String(g).replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase()}`;
  const termTabs = (after) => h("div", { class: "term-tabs", role: "tablist", "aria-label": "Term" }, [1, 2, 3].map((t2) => h("button", { role: "tab", "aria-selected": String(ui.term === t2), onclick: () => { ui.term = t2; after(); } }, LBL[t2])));
  function scoresTab() {
    const c = model(); const term = String(ui.term); const q = ui.q.toLowerCase(); const rows = new Map();
    const stat = (label, el) => h("div", { class: "kpi" }, h("div", { class: "kpi-l" }, label), el);
    const progress = h("div", { class: "kpi-bar", role: "progressbar", "aria-label": "Students scored" }, h("span", { class: "kpi-fill" }));
    const kScored = h("div", { class: "kpi-v" }), kAvg = h("div", { class: "kpi-v" }), kHigh = h("div", { class: "kpi-v" }), kLow = h("div", { class: "kpi-v" }), dist = h("div", { class: "dist" });
    function summary() {
      const m = model(); const list = Object.keys(m.students).map((id) => calc(m, ui.term, id, w)).filter(Boolean); const total = Object.keys(m.students).length;
      kScored.textContent = `${list.length} / ${total}`; progress.firstChild.className = `kpi-fill p${Math.round((total ? list.length / total : 0) * 20) * 5}`; progress.setAttribute("aria-valuenow", String(Math.round((total ? list.length / total : 0) * 100)));
      const t = list.map((x) => x.t); kAvg.textContent = t.length ? (t.reduce((p, n) => p + n, 0) / t.length).toFixed(1) : "–"; kHigh.textContent = t.length ? Math.max(...t) : "–"; kLow.textContent = t.length ? Math.min(...t) : "–";
      const counts = {}; list.forEach((x) => { const g = grade(x.t, grades); counts[g] = (counts[g] || 0) + 1; });
      dist.replaceChildren(...grades.map((g) => h("span", { class: `gchip ${gcls(g.g)}`, title: `${g.g}: ${counts[g.g] || 0} student(s)` }, `${g.g} ${counts[g.g] || 0}`)));
    }
    function refreshRow(id) {
      const r = rows.get(id); if (!r) return; const x = calc(model(), ui.term, id, w);
      r.total.textContent = x ? x.t : "–"; r.total.className = `tot${x ? "" : " none"}`; r.grade.textContent = x ? grade(x.t, grades) : ""; r.grade.className = `gchip ${x ? gcls(grade(x.t, grades)) : "hide"}`; r.row.classList.toggle("done", Boolean(x)); summary();
    }
    const rowFor = (stu) => {
      const x = calc(c, ui.term, stu.id, w); const total = h("span", { class: `tot${x ? "" : " none"}` }, x ? x.t : "–"); const gr = h("span", { class: `gchip ${x ? gcls(grade(x.t, grades)) : "hide"}` }, x ? grade(x.t, grades) : "");
      const cells = COLS.map(([k, label], i) => { const max = w[k]; const v = c.scores?.[term]?.[stu.id]?.[k];
        const inp = h("input", { type: "number", inputmode: "decimal", min: 0, max, step: "any", value: v ?? "", "data-s": stu.id, "data-k": k, placeholder: "–", "aria-label": `${stu.n} ${label} out of ${max}` });
        inp.addEventListener("input", () => { let val = inp.value; if (val !== "") { const n = Math.min(max, Math.max(0, +val)); if (n !== +val) { val = String(n); inp.value = val; } } const row = ((sheet ||= { subject: cur.subject, scores: {} }).scores[term] ||= {}); const r = (row[stu.id] ||= {}); if (val === "") delete r[k]; else r[k] = +val; if (!Object.keys(r).length) delete row[stu.id]; refreshRow(stu.id); queueSave(stu.id, k, val); });
        inp.addEventListener("keydown", (e) => { const all = [...body.querySelectorAll(`input[data-k="${k}"]`)]; const at = all.indexOf(inp); if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); (all[at + 1] || all[0]).focus(); } else if (e.key === "ArrowUp") { e.preventDefault(); (all[at - 1] || all[all.length - 1]).focus(); } });
        inp.addEventListener("focus", () => inp.select());
        return h("label", { class: `sc ${i > 3 ? "bonus" : "main"}` }, h("span", { class: "lab" }, `${label} /${max}`), inp); });
      const row = h("div", { class: `srow${x ? " done" : ""}`, role: "group", "aria-label": stu.n },
        h("div", { class: "sname" }, h("span", { class: "avatar", "aria-hidden": "true" }, initials(stu.n)), h("div", {}, h("strong", {}, stu.n), stu.r ? h("span", { class: "tag tag-warn" }, "Repeater") : null,
          h("button", { class: "linkbtn", type: "button", onclick: () => formDialog(stu.n, (close) => h("div", {}, subjectReport(model(), stu.id, s, w, grades, session), h("div", { class: "dlg-actions" }, h("button", { class: "btn", onclick: () => close() }, "Close"), h("button", { class: "btn btn-primary", onclick: () => printNodes([subjectReport(model(), stu.id, s, w, grades, session)]) }, "Print")))) }, "Report"))),
        cells, h("div", { class: "stot" }, total, gr));
      rows.set(stu.id, { row, total, grade: gr }); return row;
    };
    const unscored = (stu) => !calc(c, ui.term, stu.id, w);
    const vis = (stu) => (!q || stu.n.toLowerCase().includes(q)) && (ui.sex === "all" || (ui.sex === "M" ? stu.s === "M" : stu.s === "F")) && (!ui.todo || unscored(stu));
    const seg = (id, label, v) => h("button", { type: "button", role: "radio", "aria-checked": String(ui.sex === v), onclick: () => { ui.sex = v; scoresTab(); } }, label);
    const sections = groups(c).map(([label, list]) => { const l = list.filter(vis); return l.length ? [h("h2", { class: "sec" }, label, h("span", { class: "count" }, l.length)), h("div", { class: "sheet" }, h("div", { class: "shead", "aria-hidden": "true" }, h("span", {}, "Student"), COLS.map(([k, label2]) => h("span", {}, `${label2}`, h("small", {}, ` /${w[k]}`))), h("span", {}, "Total")), l.map(rowFor))] : null; });
    mount(body, termTabs(scoresTab),
      h("div", { class: "kpis" }, stat("Scored", h("div", {}, kScored, progress)), stat("Class average", kAvg), stat("Highest", kHigh), stat("Lowest", kLow), stat("Grades", dist)),
      h("div", { class: "filters sticky-f" }, h("input", { type: "search", placeholder: "Find a student", "aria-label": "Find a student", value: ui.q, oninput: (e) => { ui.q = e.target.value; const p = e.target.selectionStart; scoresTab(); const n = body.querySelector("input[type=search]"); n.focus(); n.setSelectionRange(p, p); } }),
        h("div", { class: "seg", role: "radiogroup", "aria-label": "Show" }, seg("all", "All", "all"), seg("m", "Male", "M"), seg("f", "Female", "F")),
        h("label", { class: "chk" }, h("input", { type: "checkbox", checked: ui.todo, onchange: (e) => { ui.todo = e.target.checked; scoresTab(); } }), "Not scored yet"),
        h("label", { class: "chk" }, h("input", { type: "checkbox", checked: c.bonus, onchange: async (e) => { (sheet ||= { subject: cur.subject, scores: {} }).bonus = e.target.checked; scoresTab(); try { await saveSheetFlag(session, cur.subject, cur.key, { bonus: e.target.checked }); } catch (err) { toast(friendlyAuthError(err), "error"); } } }), "Add bonus marks to exam")),
      sections.flat().length ? sections : empty("No students to show", "Change the search or filters."));
    summary();
  }
  function resultsTab() {
    const c = model(); const year = ui.view === "year";
    const list = students(c).map((stu) => ({ stu, x: calc(c, ui.term, stu.id, w), an: annual(c, stu.id, w), p: rankOf(c, ui.term, stu.id, w) }));
    const ranked = (year ? list.filter((r) => r.an.n) : list.filter((r) => r.x)).sort((p, q) => (year ? q.an.avg - p.an.avg : q.x.t - p.x.t));
    const unranked = list.filter((r) => !ranked.includes(r));
    let pos = 0, last = null, shown = 0; const key = (r) => (year ? r.an.avg : r.x.t);
    const medal = (n) => (n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : "");
    const rowsEl = ranked.map((r) => { shown++; if (key(r) !== last) { pos = shown; last = key(r); }
      const g = grade(year ? r.an.avg : r.x.t, grades);
      return h("tr", { class: pos <= 3 ? "top" : "" }, h("td", { class: "posc" }, medal(pos) || ord(pos)), h("th", { scope: "row" }, r.stu.n, r.stu.r ? h("span", { class: "tag tag-warn" }, "Repeater") : null),
        year ? [1, 2, 3].map((t2) => h("td", {}, r.an.t[t2] ? r.an.t[t2].t : "–")) : [r.x.a, r.x.b, r.x.c, r.x.ex].map((v) => h("td", {}, v)),
        h("td", { class: "totc" }, year ? r.an.avg : r.x.t), h("td", {}, h("span", { class: `gchip ${gcls(g)}` }, g))); });
    const head = year ? ["Position", "Student", "1st term", "2nd term", "3rd term", "Average", "Grade"] : ["Position", "Student", "1st CA", "2nd CA", "Open day", "Exam", "Total", "Grade"];
    const csv = () => downloadCsv(`${classLabel(cur.key)}_${cur.subject.replace(/\W+/g, "_")}_${year ? "year" : "term" + ui.term}.csv`, [head, ...ranked.map((r, i) => (year ? [i + 1, r.stu.n, ...[1, 2, 3].map((t2) => r.an.t[t2]?.t ?? ""), r.an.avg, grade(r.an.avg, grades)] : [i + 1, r.stu.n, r.x.a, r.x.b, r.x.c, r.x.ex, r.x.t, grade(r.x.t, grades)]))]);
    mount(body, h("div", { class: "toolbar" }, h("div", { class: "seg", role: "radiogroup", "aria-label": "View" }, h("button", { type: "button", role: "radio", "aria-checked": String(!year), onclick: () => { ui.view = "term"; resultsTab(); } }, "One term"), h("button", { type: "button", role: "radio", "aria-checked": String(year), onclick: () => { ui.view = "year"; resultsTab(); } }, "Whole year")), h("button", { class: "btn btn-sm", onclick: csv, disabled: !ranked.length }, "Export CSV")),
      year ? null : termTabs(resultsTab),
      ranked.length ? h("div", { class: "table-wrap results" }, h("table", {}, h("thead", {}, h("tr", {}, head.map((x) => h("th", { scope: "col" }, x)))), h("tbody", {}, rowsEl))) : empty("No results yet", "Scores appear here as soon as they are entered."),
      unranked.length ? h("p", { class: "muted" }, `${unranked.length} student${unranked.length === 1 ? "" : "s"} not scored yet.`) : null);
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
