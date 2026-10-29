import { h, mount, empty, skeleton } from "../lib/dom.js";
import { state, roleOf } from "../lib/store.js";
import { studentsOnce, listSheets, loadSheet, loadRemarks, loadTerm, exportCollection, loadStudentAttendance } from "../lib/data.js";
import { isEnrolled, classKey as makeKey } from "../lib/students.js";
import { buildClassCards } from "../lib/reportcard.js";
import { calc, LBL, ord } from "../lib/scores.js";
import { toSheetModel } from "../lib/reports.js";
import { lineChart, barChart, sparkline } from "../lib/charts.js";
import { overall, subjectNames, subjectsThisTerm, subjectTrend, conductSeries, traitBars, highlights, gradeCounts, weeklyAttendance, absentDays, classStats, subjectGroup, termsWith, TERM_LABELS } from "../lib/progress.js";
import { weekSummary, todayStr, dstr, addDays, parseD } from "../lib/attendance.js";
import { select, classLabel, friendlyAuthError } from "./common.js";
import { subjectsForClass, armsOf } from "../lib/structure.js";
import { showDate } from "../lib/dates.js";

const arrow = (t) => (t > 0 ? h("span", { class: "up", title: "Up on last term" }, "▲") : t < 0 ? h("span", { class: "down", title: "Down on last term" }, "▼") : h("span", { class: "flat", title: "About the same" }, "●"));
const kpi = (label, value, sub) => h("div", { class: "kpi" }, h("div", { class: "kpi-l" }, label), h("div", { class: "kpi-v" }, value), sub ? h("div", { class: "hint" }, sub) : null);
const list = (title, items, fmt) => h("div", { class: "hl" }, h("h3", {}, title), items.length ? h("ul", {}, items.map((i) => h("li", {}, fmt(i)))) : h("p", { class: "muted" }, "Nothing to show yet."));
const termTabs = (terms, current, onPick) => h("div", { class: "term-tabs", role: "tablist", "aria-label": "Term" }, terms.map((t) => h("button", { role: "tab", "aria-selected": String(t === current), onclick: () => onPick(t) }, LBL[t])));
const sign = (n) => (n > 0 ? `+${n}` : String(n));

/**
 * One student's progress, drawn from their report cards (one per term). Used by staff and, with published cards only, by parents.
 * mode "parent" only wording differs; the data a parent passes in is already limited to their child and published terms.
 */
export function studentPanel({ name, cardsByTerm, attendance, notes = [], mode = "staff" }) {
  const terms = termsWith(cardsByTerm); const ui = { term: terms[terms.length - 1] || 1, subject: subjectNames(cardsByTerm)[0] || "" };
  const host = h("div", { class: "progress" });
  function draw() {
    if (!terms.length) return mount(host, empty("No results yet", mode === "parent" ? "Results appear here after the school publishes a term." : "Scores appear here as soon as they are entered."));
    const card = cardsByTerm[ui.term]; const o = overall(cardsByTerm); const hi = highlights(cardsByTerm, ui.term); const wk = weeklyAttendance(attendance, ui.term); const cs = conductSeries(cardsByTerm);
    const att = wk.pct !== null ? wk.pct : card.attendance?.opened ? Math.round((card.attendance.present / card.attendance.opened) * 1000) / 10 : null;
    const best = card.totals.percent >= (card.totals.classPercent ?? 0);
    const subj = subjectsThisTerm(card); const tr = subjectTrend(cardsByTerm, ui.subject);
    const lbl = (a) => TERM_LABELS.map((t, i) => (a[i] !== null ? t : t));
    mount(host,
      terms.length > 1 ? termTabs(terms, ui.term, (t) => { ui.term = t; draw(); }) : null,
      h("div", { class: "kpis" }, kpi("Overall", `${card.totals.percent}%`, card.totals.classPercent ? `Class average ${card.totals.classPercent}% · ${best ? "above" : "below"} average` : null), kpi("Class position", card.counts.position ? `${ord(card.counts.position)} of ${card.counts.classSize}` : "–", "by total percentage"),
        kpi("Attendance", att === null ? "–" : `${att}%`, wk.opened ? `${wk.present} of ${wk.opened} marks` : card.attendance?.opened ? `${card.attendance.present} of ${card.attendance.opened} marks` : "not recorded"), kpi("Conduct", card.affective.total ? `${card.affective.obtained}/${card.affective.total}` : "–", card.psychomotor.total ? `Skills ${card.psychomotor.obtained}/${card.psychomotor.total}` : null)),
      h("div", { class: "charts" },
        lineChart({ title: "Overall percentage by term", labels: lbl(o.student), series: [{ name: name, values: o.student, cls: 0 }, ...(o.klass.some((v) => v !== null) ? [{ name: "Class average", values: o.klass, cls: 6 }] : [])], unit: "%", summary: `Latest ${card.totals.percent} percent.` }),
        lineChart({ title: "Class position by term (1 is best)", labels: TERM_LABELS, series: [{ name: "Position", values: o.position, cls: 2 }], yMin: 1, yMax: Math.max(5, ...o.size.filter(Boolean)), reverse: true, summary: `Position ${card.counts.position}.` }),
        barChart({ title: `Subjects, ${LBL[ui.term]}`, items: subj, horizontal: true, valueName: "Student", markerName: "Class average", summary: subj.length ? `Best ${subj[0].label} ${subj[0].value}.` : "" }),
        h("div", {}, h("div", { class: "toolbar" }, h("label", { class: "chk" }, "Subject", select(subjectNames(cardsByTerm).map((s) => [s, s]), ui.subject, { "aria-label": "Subject", onchange: (e) => { ui.subject = e.target.value; draw(); } }))),
          lineChart({ title: `${ui.subject} across the terms`, labels: TERM_LABELS, series: [{ name: "Total", values: tr.total, cls: 0 }, { name: "Class average", values: tr.classAvg, cls: 6 }, { name: "Exam", values: tr.exam, cls: 3 }, { name: "C.A.", values: tr.ca, cls: 1 }], yMax: 100, summary: "" })),
        att !== null && wk.labels.length ? barChart({ title: `Attendance by week, ${LBL[ui.term]}`, items: wk.labels.map((l, i) => ({ label: l, value: wk.values[i], cls: wk.values[i] !== null && wk.values[i] < 75 ? 5 : 2 })), max: 100, unit: "%", summary: `Term attendance ${att} percent.` }) : null,
        cs.behavioural.some((v) => v !== null) ? lineChart({ title: "Conduct by term", labels: TERM_LABELS, series: [{ name: "Behavioural", values: cs.behavioural, cls: 2 }, { name: "Psychomotor", values: cs.psychomotor, cls: 3 }], unit: "%" }) : null,
        traitBars(card).length ? barChart({ title: `Conduct ratings, ${LBL[ui.term]}`, items: traitBars(card), horizontal: true, max: 5, color: 2, valueName: "Rating (5 is best)" }) : null),
      h("div", { class: "hls" }, list("Strongest subjects", hi.best, (s) => `${s.label}: ${s.value}`), list("Needs most attention", hi.weakest, (s) => `${s.label}: ${s.value}`),
        hi.prevTerm ? list(`Improved since ${LBL[hi.prevTerm]}`, hi.improved, (m) => `${m.label} ${sign(m.change)}`) : null, hi.prevTerm ? list(`Dropped since ${LBL[hi.prevTerm]}`, hi.declined, (m) => `${m.label} ${sign(m.change)}`) : null,
        list("Grades this term", Object.entries(gradeCounts(card)).sort(), ([g, n]) => `${g}: ${n} subject${n === 1 ? "" : "s"}`)),
      attendance && absentDays(attendance, ui.term).length ? h("div", { class: "hl" }, h("h3", {}, "Days missed"), h("ul", { class: "cols" }, absentDays(attendance, ui.term).slice(-12).map((a) => h("li", {}, `${showDate(a.date)}${a.marks ? " (half day)" : ""}`, notes.find((n) => n.date === a.date) ? h("small", { class: "pnote" }, ` Note: ${notes.find((n) => n.date === a.date).reason}`) : null)))) : null);
  }
  draw(); return host;
}

/** A subject teacher's view of one student in their subject only: no other subjects, attendance or conduct. */
export function subjectStudentPanel({ name, subject, group, row }) {
  const terms = [1, 2, 3]; const gi = (t) => group.terms[t - 1]; const calcRow = row.parts;
  return h("div", { class: "progress" }, h("div", { class: "kpis" }, kpi(subject, row.latest === null ? "–" : String(row.latest), row.latest === null ? "" : `Class average ${gi(group.latest)?.avg ?? "–"}`), kpi("Position in subject", row.position ? `${ord(row.position)} of ${group.students.length}` : "–"), kpi("Trend", row.trend > 0 ? "Improving" : row.trend < 0 ? "Dropping" : "Steady")),
    h("div", { class: "charts" },
      lineChart({ title: `${subject}: ${name} against the class`, labels: TERM_LABELS, series: [{ name: "Student", values: row.totals, cls: 0 }, { name: "Class average", values: terms.map((t) => gi(t)?.avg ?? null), cls: 6 }, { name: "Highest", values: terms.map((t) => gi(t)?.max ?? null), cls: 2 }], yMax: 100 }),
      lineChart({ title: "Continuous assessment and exam", labels: TERM_LABELS, series: [{ name: "C.A. (30)", values: calcRow.map((p) => p?.ca ?? null), cls: 1 }, { name: "Exam (70)", values: calcRow.map((p) => p?.ex ?? null), cls: 3 }], yMax: 70 })));
}

async function classData(key, upTo) {
  const s = state.school; const session = s.current.session;
  const roster = (await studentsOnce()).filter((x) => isEnrolled(x) && x.classKey === key); const sheets = await listSheets(session, key);
  const byTerm = {}; for (let t = 1; t <= upTo; t++) { const remarks = await loadRemarks(session, t, key).catch(() => ({})); byTerm[t] = buildClassCards({ roster, sheets, term: t, session, school: { ...s, id: s.id }, attendance: {}, remarks }); }
  return { roster, byTerm };
}
async function classWeeklyAttendance(key, roster, term) {
  const s = state.school; const info = await loadTerm(s.current.session, term).catch(() => null); if (!info?.startDate) return null;
  const { getDocs, query, where, collection } = await import("firebase/firestore"); const { db } = await import("../lib/firebase.js"); const weeks = info.weeks || 13;
  const end = dstr(addDays(parseD(info.startDate), weeks * 7 - 1)); const snap = await getDocs(query(collection(db, `schools/${s.id}/attendance`), where("classKey", "==", key), where("date", ">=", info.startDate), where("date", "<=", end)));
  const att = {}; snap.docs.forEach((d) => (att[d.data().date] = d.data().marks || {})); const hol = {}; (await exportCollection("holidays").catch(() => [])).forEach((d) => (hol[d.id] = { label: d.reason }));
  const labels = [], values = []; for (let w = 1; w <= weeks; w++) { const sum = weekSummary({ students: roster.map((r) => ({ id: r.id, name: r.name, gender: r.gender })), attendance: att, holidays: hol, termStart: info.startDate, week: w, today: todayStr() }); if (sum.schoolDays) { labels.push(`Wk ${w}`); values.push(Math.round(sum.pct * 10) / 10); } }
  return values.length ? { labels, values } : null;
}

function classDashboard(host, key, onStudent) {
  const s = state.school; const upTo = s.current.term; mount(host, skeleton(5));
  classData(key, upTo).then(async ({ roster, byTerm }) => {
    const c = classStats(byTerm); if (!c.latest) return mount(host, empty("No scores yet", `Scores for ${classLabel(key)} appear here as soon as teachers enter them.`));
    const att = await classWeeklyAttendance(key, roster, c.latest).catch(() => null); const grades = s.scoring.grades.map((g) => g.g);
    mount(host, h("div", { class: "kpis" }, kpi("Students", String(c.size)), kpi(`Class average, ${LBL[c.latest]}`, `${c.stats[c.latest - 1].avg}%`, `Highest ${c.stats[c.latest - 1].max}% · lowest ${c.stats[c.latest - 1].min}%`), kpi("Need attention", String(c.atRisk.length), "failed a subject or below 40%"), kpi("Dropping", String(c.declining.length), "lower than last term"), kpi("Attendance", att ? `${Math.round((att.values.reduce((p, n) => p + n, 0) / att.values.length) * 10) / 10}%` : "–", att ? "average of the weeks so far" : "")),
      h("div", { class: "charts" },
        lineChart({ title: "Class percentage by term", labels: TERM_LABELS, series: [{ name: "Average", values: c.stats.map((x) => x?.avg ?? null), cls: 0 }, { name: "Highest", values: c.stats.map((x) => x?.max ?? null), cls: 2 }, { name: "Lowest", values: c.stats.map((x) => x?.min ?? null), cls: 5 }], unit: "%" }),
        barChart({ title: `Score spread, ${LBL[c.latest]}`, items: c.histogram, max: Math.max(5, ...c.histogram.map((x) => x.value)), valueName: "Students" }),
        barChart({ title: `Subject averages, ${LBL[c.latest]}`, items: c.subjectAverages, horizontal: true, valueName: "This term", markerName: "Last term" }),
        barChart({ title: `Grades given, ${LBL[c.latest]}`, items: grades.map((g) => ({ label: g, value: c.grades[g] || 0 })), max: Math.max(5, ...Object.values(c.grades)), valueName: "Subjects", color: 3 }),
        att ? barChart({ title: "Class attendance by week", items: att.labels.map((l, i) => ({ label: l, value: att.values[i], cls: att.values[i] < 75 ? 5 : 2 })), max: 100, unit: "%" }) : null),
      h("h2", {}, "Students"),
      c.atRisk.length ? h("div", { class: "banner banner-warn" }, `Needs attention: ${c.atRisk.map((x) => x.name).join(", ")}`) : null,
      h("div", { class: "table-wrap stack-table" }, h("table", {}, h("thead", {}, h("tr", {}, ["Pos.", "Student", "%", "Trend", "Terms", ""].map((x) => h("th", { scope: "col" }, x)))),
        h("tbody", {}, c.students.map((x) => h("tr", {}, h("td", {}, String(x.position)), h("th", { scope: "row" }, x.name, x.atRisk ? h("span", { class: "tag tag-err" }, "Attention") : null), h("td", {}, `${x.percent}%`), h("td", {}, arrow(x.trend)), h("td", {}, sparkline(x.pct)), h("td", {}, h("button", { class: "btn btn-sm", onclick: () => onStudent(x.id, byTerm) }, "Open")))))))); 
  }).catch((e) => mount(host, empty("Cannot load progress", friendlyAuthError(e))));
}

function subjectDashboard(host, subject, key, onStudent) {
  const s = state.school; const w = s.scoring.weights; mount(host, skeleton(5));
  Promise.all([studentsOnce(), loadSheet(s.current.session, subject, key)]).then(([all, sheet]) => {
    const roster = all.filter((x) => isEnrolled(x) && x.classKey === key); const model = toSheetModel(sheet || { subject, scores: {} }, roster); const g = subjectGroup(model, roster, { calc, weights: w });
    if (!g.latest) return mount(host, empty("No scores yet", `${subject} scores for ${classLabel(key)} appear here as soon as they are entered.`));
    const cur = g.terms[g.latest - 1];
    mount(host, h("div", { class: "kpis" }, kpi("Students scored", `${cur.n}`, g.notScored ? `${g.notScored} not scored yet` : "everyone"), kpi(`Class average, ${LBL[g.latest]}`, String(cur.avg), `Highest ${cur.max} · lowest ${cur.min}`), kpi("Passed (40+)", `${cur.pass}%`), kpi("Need attention", String(g.atRisk.length), "below 40")),
      h("div", { class: "charts" },
        lineChart({ title: `${subject}: class average by term`, labels: TERM_LABELS, series: [{ name: "Average", values: g.terms.map((t) => t?.avg ?? null), cls: 0 }, { name: "Highest", values: g.terms.map((t) => t?.max ?? null), cls: 2 }, { name: "Lowest", values: g.terms.map((t) => t?.min ?? null), cls: 5 }], yMax: 100 }),
        lineChart({ title: "Continuous assessment and exam averages", labels: TERM_LABELS, series: [{ name: "C.A. (30)", values: g.terms.map((t) => t?.ca ?? null), cls: 1 }, { name: "Exam (70)", values: g.terms.map((t) => t?.exam ?? null), cls: 3 }], yMax: 70 }),
        barChart({ title: `Score spread, ${LBL[g.latest]}`, items: g.histogram, max: Math.max(5, ...g.histogram.map((x) => x.value)), valueName: "Students" })),
      h("h2", {}, "Students"),
      h("div", { class: "table-wrap stack-table" }, h("table", {}, h("thead", {}, h("tr", {}, ["Pos.", "Student", "Latest", "Trend", "Terms", ""].map((x) => h("th", { scope: "col" }, x)))),
        h("tbody", {}, g.students.map((x) => h("tr", {}, h("td", {}, String(x.position)), h("th", { scope: "row" }, x.name, x.atRisk ? h("span", { class: "tag tag-err" }, "Attention") : null), h("td", {}, String(x.latest)), h("td", {}, arrow(x.trend)), h("td", {}, sparkline(x.totals)), h("td", {}, h("button", { class: "btn btn-sm", onclick: () => onStudent(x.id, { g, model, roster }) }, "Open"))))))));
  }).catch((e) => mount(host, empty("Cannot load progress", friendlyAuthError(e))));
}

/** Other screens call this to jump straight to a student's progress. */
export function goToProgress({ studentId, mode = "class", subject = "", key = "" }) {
  sessionStorage.setItem("tb-progress", JSON.stringify({ studentId, mode, subject, key })); const base = state.isOwner ? "admin" : roleOf(); const target = `#/${base}/progress`;
  if (location.hash === target) dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = target;
}

export async function progressView(host) {
  const s = state.school; const admin = roleOf() === "owner" || roleOf() === "admin"; const p = state.profile;
  const options = []; // what this person may track
  if (admin) { for (const c of s.structure.classes) for (const a of armsOf(c)) options.push({ type: "class", key: makeKey(c.name, a), label: `${classLabel(makeKey(c.name, a))}: whole class` }); }
  else { if (p.classTeacherKey) options.push({ type: "class", key: p.classTeacherKey, label: `My class: ${classLabel(p.classTeacherKey)}` }); for (const a of p.assignmentsList || []) options.push({ type: "subject", key: makeKey(a.class, a.arm), subject: a.subject, label: `${a.subject}, ${classLabel(makeKey(a.class, a.arm))}` }); }
  if (!options.length) return mount(host, h("h1", {}, "Progress"), empty("Nothing to track yet", "You will see your classes and subjects here once the school admin has assigned them."));
  const jump = (() => { try { const j = JSON.parse(sessionStorage.getItem("tb-progress") || "null"); sessionStorage.removeItem("tb-progress"); return j; } catch { return null; } })();
  const id = (o) => `${o.type}:${o.key}:${o.subject || ""}`; let cur = options.find((o) => jump && o.type === jump.mode && o.key === jump.key && (o.subject || "") === (jump.subject || "")) || options.find((o) => id(o) === localStorage.getItem("tb-progress-pick")) || options[0];
  const body = h("div", {}); const subjSel = admin ? select([["", "All subjects (class overview)"], ...subjectsForClass(s.structure, cur.key.split("|")[0]).map((x) => [x, x])], jump?.mode === "subject" ? jump.subject : "", { "aria-label": "Subject", onchange: () => show() }) : null;
  const sel = select(options.map((o) => [id(o), o.label]), id(cur), { "aria-label": "Class or subject to track", onchange: (e) => { cur = options.find((o) => id(o) === e.target.value); localStorage.setItem("tb-progress-pick", e.target.value); if (subjSel) { subjSel.replaceChildren(...[["", "All subjects (class overview)"], ...subjectsForClass(s.structure, cur.key.split("|")[0]).map((x) => [x, x])].map(([v, l]) => h("option", { value: v }, l))); } show(); } });
  const back = (fn) => h("button", { class: "btn btn-sm", type: "button", onclick: fn }, "← Back");
  mount(host, h("h1", {}, "Progress"), h("p", { class: "muted" }, "Track a class or subject as a group, then open a student to see their progress."), h("div", { class: "toolbar" }, sel, subjSel), body);
  function openStudent(sid, ctx) {
    const mode = admin ? (subjSel?.value ? "subject" : "class") : cur.type; const again = () => show();
    if (mode === "class") {
      const byTerm = ctx || null; const cardsByTerm = {}; [1, 2, 3].forEach((t) => { const c = (byTerm?.[t] || []).find((x) => x.studentId === sid); if (c) cardsByTerm[t] = c; });
      const name = Object.values(cardsByTerm)[0]?.student.name || ""; mount(body, h("div", { class: "toolbar" }, back(again), h("h2", { class: "inline" }, name)), skeleton(3));
      loadStudentAttendance(s.id, s.current.session, sid).then((att) => mount(body, h("div", { class: "toolbar" }, back(again), h("h2", { class: "inline" }, name)), studentPanel({ name, cardsByTerm, attendance: att })));
    } else {
      const { g, model, roster } = ctx; const row = g.students.find((x) => x.id === sid); const name = roster.find((x) => x.id === sid)?.name || ""; row.parts = [1, 2, 3].map((t) => { const x = calc(model, t, sid, s.scoring.weights); return x ? { ca: x.a + x.b + x.c, ex: x.ex } : null; });
      mount(body, h("div", { class: "toolbar" }, back(again), h("h2", { class: "inline" }, name)), subjectStudentPanel({ name, subject: admin ? subjSel.value : cur.subject, group: g, row }));
    }
  }
  function show() {
    const mode = admin ? (subjSel.value ? "subject" : "class") : cur.type;
    if (mode === "class") classDashboard(body, cur.key, openStudent); else subjectDashboard(body, admin ? subjSel.value : cur.subject, cur.key, openStudent);
  }
  if (jump?.studentId) {
    const mode = admin ? (jump.mode === "subject" ? "subject" : "class") : cur.type;
    if (mode === "class") classData(cur.key, s.current.term).then(({ byTerm }) => openStudent(jump.studentId, byTerm)); else Promise.all([studentsOnce(), loadSheet(s.current.session, admin ? jump.subject : cur.subject, cur.key)]).then(([all, sheet]) => { const roster = all.filter((x) => isEnrolled(x) && x.classKey === cur.key); const model = toSheetModel(sheet || { subject: cur.subject, scores: {} }, roster); openStudent(jump.studentId, { g: subjectGroup(model, roster, { calc, weights: s.scoring.weights }), model, roster }); });
  } else show();
}
export { subjectsForClass };
