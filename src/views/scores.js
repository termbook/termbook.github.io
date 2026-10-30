import { h, mount, toast, empty, skeleton, field, initials, formDialog, downloadCsv } from "../lib/dom.js";
import { state, roleOf } from "../lib/store.js";
import { watchStudents, loadSheet, saveCell, saveSheetFlag, sheetId } from "../lib/data.js";
import { isEnrolled, classKey } from "../lib/students.js";
import { calc, annual, rankOf, termStats, grade, ord, LBL, sheetRows, groups, students } from "../lib/scores.js";
import { toSheetModel } from "../lib/reports.js";
import { select, classLabel, friendlyAuthError } from "./common.js";
import { subjectsForClass, armsOf } from "../lib/structure.js";
import { goToProgress } from "./progress.js";

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
  if (admin) options = s.structure.classes.flatMap((c) => armsOf(c).flatMap((a) => subjectsForClass(s.structure, c.name).map((sub) => ({ subject: sub, key: classKey(c.name, a) }))));
  else options = (state.profile.assignmentsList || []).map((a) => ({ subject: a.subject, key: classKey(a.class, a.arm) }));
  if (!options.length) return mount(host, h("h1", {}, "Scores"), empty("No subjects assigned", "Your school admin has not given you a subject and class yet."));
  // Two steps: choose the class, then one of that class's subjects (never a long list of every class and subject together).
  const classKeys = [...new Set(options.map((o) => o.key))]; const subjectsOf = (key) => [...new Set(options.filter((o) => o.key === key).map((o) => o.subject))];
  let cur = { key: classKeys.includes(localStorage.getItem("tb-score-class")) ? localStorage.getItem("tb-score-class") : classKeys[0] };
  cur.subject = subjectsOf(cur.key).includes(localStorage.getItem("tb-score-subject")) ? localStorage.getItem("tb-score-subject") : subjectsOf(cur.key)[0];
  const ui = { tab: "scores", term: s.current.term, q: "", sex: "all", todo: false, view: "term" }; const body = h("div", {}); let roster = null, sheet = null; const saved = h("span", { class: "chip", role: "status" }, "Saved ✓");
  const store = () => { localStorage.setItem("tb-score-class", cur.key); localStorage.setItem("tb-score-subject", cur.subject); };
  const chipRow = (label, opts, current, onPick) => h("div", { class: "chiprow" }, h("span", { class: "chiplabel" }, label), h("div", { class: "chips", role: "tablist", "aria-label": label }, opts.map(([v, l]) => h("button", { type: "button", role: "tab", "data-v": v, "aria-selected": String(v === current), onclick: () => onPick(v) }, l))));
  const pickers = h("div", { class: "pickers2" });
  function drawPickers() {
    mount(pickers, chipRow("Class", classKeys.map((k) => [k, classLabel(k)]), cur.key, (k) => { cur.key = k; const subs = subjectsOf(k); if (!subs.includes(cur.subject)) cur.subject = subs[0]; store(); drawPickers(); open(); }),
      chipRow("Subject", subjectsOf(cur.key).map((x) => [x, x]), cur.subject, (x) => { cur.subject = x; store(); drawPickers(); open(); }), h("div", { class: "pickers2-s" }, saved));
  }
  const tabs = h("div", { class: "subtabs", role: "tablist" }, [["scores", "Scores"], ["results", "Results"], ["students", "Students"], ["class", "Class"]].map(([id, l]) => h("button", { class: "tabbtn", role: "tab", "aria-selected": String(ui.tab === id), onclick: () => { ui.tab = id; tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.textContent === l))); draw(); } }, l)));
  drawPickers(); mount(host, pickers, tabs, body);
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
  const setSaved = (t) => { saved.textContent = t; document.querySelectorAll(".sheet-saved").forEach((x) => (x.textContent = t)); };
  const mainFilled = (id) => { const r = sheet?.scores?.[String(ui.term)]?.[id] || {}; return ["a", "b", "c", "e"].filter((k) => r[k] !== undefined).length; };

  function scoresTab() {
    const c = model(); const q = ui.q.toLowerCase(); const rows = new Map(); let order = [];
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
      const r = rows.get(id); if (!r) return; const x = calc(model(), ui.term, id, w); const n = mainFilled(id);
      r.total.textContent = x ? x.t : "–"; r.total.className = `tot${x ? "" : " none"}`; r.grade.textContent = x ? grade(x.t, grades) : ""; r.grade.className = `gchip ${x ? gcls(grade(x.t, grades)) : "hide"}`;
      r.sub.textContent = n === 0 ? "Tap to enter scores" : n === 4 ? "All scores entered" : `${n} of 4 entered`; r.row.dataset.state = n === 0 ? "empty" : n === 4 ? "done" : "part"; summary();
    }
    const rowFor = (stu) => {
      const x = calc(c, ui.term, stu.id, w); const n = mainFilled(stu.id);
      const total = h("span", { class: `tot${x ? "" : " none"}` }, x ? x.t : "–"); const gr = h("span", { class: `gchip ${x ? gcls(grade(x.t, grades)) : "hide"}` }, x ? grade(x.t, grades) : "");
      const sub = h("span", { class: "sub" }, n === 0 ? "Tap to enter scores" : n === 4 ? "All scores entered" : `${n} of 4 entered`);
      const row = h("button", { class: "srow2", type: "button", "data-s": stu.id, "data-state": n === 0 ? "empty" : n === 4 ? "done" : "part", "aria-label": `${stu.n}: open to enter scores`, onclick: () => openEditor(stu.id) },
        h("span", { class: "avatar", "aria-hidden": "true" }, initials(stu.n)), h("span", { class: "who" }, h("strong", {}, stu.n), stu.r ? h("span", { class: "tag tag-warn" }, "Repeater") : null, sub), h("span", { class: "res" }, total, gr), h("span", { class: "chev", "aria-hidden": "true" }, "›"));
      rows.set(stu.id, { row, total, grade: gr, sub }); return row;
    };
    const unscored = (stu) => !calc(c, ui.term, stu.id, w);
    const vis = (stu) => (!q || stu.n.toLowerCase().includes(q)) && (ui.sex === "all" || (ui.sex === "M" ? stu.s === "M" : stu.s === "F")) && (!ui.todo || unscored(stu));
    const seg = (label, v) => h("button", { type: "button", role: "radio", "aria-checked": String(ui.sex === v), onclick: () => { ui.sex = v; scoresTab(); } }, label);
    const sections = groups(c).map(([label, list]) => { const l = list.filter(vis); order = order.concat(l.map((x) => x.id)); return l.length ? [h("h2", { class: "sec" }, label, h("span", { class: "count" }, l.length)), h("div", { class: "slist" }, l.map(rowFor))] : null; });

    /** The student's score entry, opened by tapping their row: a bottom sheet on phones, a centred card on larger screens. */
    function openEditor(id) {
      const idx = order.indexOf(id); const stu = c.students[id]; const term = String(ui.term);
      const dlg = h("dialog", { class: "sheet-dlg", "aria-label": `Scores for ${stu.n}` }); const bonusOn = model().bonus;
      const live = h("div", { class: "live" }); const inputs = [];
      const refreshLive = () => { const x = calc(model(), ui.term, id, w); mount(live, h("div", { class: "live-t" }, h("span", { class: "live-l" }, "Total"), h("strong", {}, x ? String(x.t) : "–"), x ? h("span", { class: `gchip ${gcls(grade(x.t, grades))}` }, grade(x.t, grades)) : null), h("div", { class: "kpi-bar" }, h("span", { class: `kpi-fill p${Math.round(((x?.t || 0) / 100) * 20) * 5}` })), x && model().bonus && (x.ex !== (Number(sheet?.scores?.[term]?.[id]?.e) || 0)) ? h("p", { class: "hint" }, `Exam with bonus marks: ${x.ex}`) : null); };
      const mk = (k, label) => { const max = w[k]; const v = sheet?.scores?.[term]?.[id]?.[k];
        const inp = h("input", { type: "number", inputmode: "decimal", min: 0, max, step: "any", value: v ?? "", "data-k": k, placeholder: "–", id: `e_${k}`, "aria-label": `${label} out of ${max}` });
        inp.addEventListener("input", () => { let val = inp.value; if (val !== "") { const n = Math.min(max, Math.max(0, +val)); if (n !== +val) { val = String(n); inp.value = val; } } const row = ((sheet ||= { subject: cur.subject, scores: {} }).scores[term] ||= {}); const r = (row[id] ||= {}); if (val === "") delete r[k]; else r[k] = +val; if (!Object.keys(r).length) delete row[id]; refreshRow(id); refreshLive(); queueSave(id, k, val); });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const at = inputs.indexOf(inp); if (inputs[at + 1]) inputs[at + 1].focus(); else go(1); } });
        inp.addEventListener("focus", () => inp.select()); inputs.push(inp);
        return h("label", { class: "bigf", for: `e_${k}` }, h("span", {}, label, h("small", {}, ` /${max}`)), inp); };
      const go = (d) => { const nid = order[idx + d]; if (!nid) { dlg.close(); return; } dlg.close(); openEditor(nid); };
      dlg.append(h("header", { class: "sheet-h" }, h("span", { class: "avatar", "aria-hidden": "true" }, initials(stu.n)), h("div", { class: "grow" }, h("strong", {}, stu.n), h("div", { class: "hint" }, `${cur.subject} · ${classLabel(cur.key)} · ${LBL[ui.term]} · ${idx + 1} of ${order.length}`)), h("button", { class: "btn btn-icon", type: "button", "aria-label": "Close", onclick: () => dlg.close() }, "✕")),
        h("div", { class: "sheet-b" },
          h("fieldset", { class: "grp" }, h("legend", {}, "Continuous assessment"), h("div", { class: "trio" }, mk("a", "1st CA"), mk("b", "2nd CA"), mk("c", "Open day"))),
          h("fieldset", { class: "grp" }, h("legend", {}, "Exam"), mk("e", "Exam")),
          bonusOn ? h("fieldset", { class: "grp" }, h("legend", {}, "Bonus marks (added to the exam)"), h("div", { class: "trio" }, mk("at", "Attendance"), mk("tb", "Textbook"), mk("nb", "Notebook"))) : h("p", { class: "hint" }, "Bonus marks are switched off for this sheet."),
          live),
        h("footer", { class: "sheet-f" }, h("span", { class: "chip sheet-saved" }, saved.textContent), h("span", { class: "hint" }, "Saves automatically when you close this."), h("div", { class: "stack-row" }, h("button", { class: "btn", type: "button", disabled: idx <= 0, onclick: () => go(-1) }, "‹ Previous"), h("button", { class: "btn", type: "button", disabled: idx >= order.length - 1, onclick: () => go(1) }, "Next ›"), h("button", { class: "btn btn-primary", type: "button", onclick: () => dlg.close() }, "Save")),
          h("button", { class: "linkbtn", type: "button", onclick: () => { dlg.close(); goToProgress({ studentId: id, mode: "subject", subject: cur.subject, key: cur.key }); } }, "View progress")));
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); dlg.addEventListener("close", () => { flush(); dlg.remove(); }); document.body.append(dlg); dlg.showModal(); refreshLive(); setTimeout(() => inputs[0]?.focus(), 60);
    }
    mount(body, termTabs(scoresTab),
      h("div", { class: "kpis compact" }, h("div", { class: "kpi" }, h("div", { class: "kpi-l" }, "Scored"), h("div", {}, kScored, progress)), h("div", { class: "kpi" }, h("div", { class: "kpi-l" }, "Average"), kAvg), h("div", { class: "kpi" }, h("div", { class: "kpi-l" }, "Highest"), kHigh), h("div", { class: "kpi" }, h("div", { class: "kpi-l" }, "Lowest"), kLow)), dist,
      h("div", { class: "filters sticky-f" }, h("input", { type: "search", placeholder: "Find a student", "aria-label": "Find a student", value: ui.q, oninput: (e) => { ui.q = e.target.value; const p = e.target.selectionStart; scoresTab(); const n = body.querySelector("input[type=search]"); n.focus(); n.setSelectionRange(p, p); } }),
        h("div", { class: "seg", role: "radiogroup", "aria-label": "Show" }, seg("All", "all"), seg("Male", "M"), seg("Female", "F")),
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
  function queueSave(sid, k, val) { pending.set(`${ui.term}|${sid}|${k}`, val); setSaved("Saving…"); clearTimeout(t); t = setTimeout(flush, 600); }
  async function flush() { const items = [...pending.entries()]; pending.clear(); try { for (const [key, val] of items) { const [tm, sid, k] = key.split("|"); await saveCell(session, cur.subject, cur.key, { teacher: state.profile?.name }, tm, sid, k, val === "" ? "" : +val); } setSaved(navigator.onLine ? "Saved ✓" : "Saved on this device"); } catch (e) { setSaved("Not saved"); toast(friendlyAuthError(e), "error"); } }
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
