import { h, mount, toast, empty, skeleton, downloadCsv, initials, confirmDialog } from "../lib/dom.js";
import { state, roleOf } from "../lib/store.js";
import { watchStudents, watchAttendance, saveAttendanceDay, watchHolidays, addHoliday, removeHoliday, loadTerm, nationalHolidays } from "../lib/data.js";
import { classPicker, classLabel, input, select, friendlyAuthError } from "./common.js";
import { isEnrolled } from "../lib/students.js";
import { SESSIONS, dstr, parseD, addDays, todayStr, weekDates, currentWeekIndex, weekSummary, termSummary, sortStudents, dayPoints, isWeekend } from "../lib/attendance.js";
import { showDate, showLong } from "../lib/dates.js";
import { dateSelect } from "../lib/datepick.js";

let subs = [];
export function stopAttendance() { subs.forEach((f) => f?.()); subs = []; }
const AM = SESSIONS.AM, PM = SESSIONS.PM;

function ring(n, total, label) {
  const pct = total ? n / total : 0, r = 20, c = 2 * Math.PI * r;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 48 48"); svg.setAttribute("class", "ring"); svg.setAttribute("aria-hidden", "true");
  for (const [cls, dash] of [["ring-bg", c], ["ring-fg", c * pct]]) { const k = document.createElementNS("http://www.w3.org/2000/svg", "circle"); k.setAttribute("cx", 24); k.setAttribute("cy", 24); k.setAttribute("r", r); k.setAttribute("class", cls); k.setAttribute("stroke-dasharray", `${dash} ${c}`); svg.append(k); }
  return h("div", { class: "ringcard" }, svg, h("div", {}, h("div", { class: "muted" }, label), h("div", { class: "big" }, n, h("span", { class: "muted" }, ` / ${total}`))));
}
const bar = (pct, label, low) => h("div", { class: "mini" }, h("div", { class: `bar${low ? " low" : ""}`, role: "img", "aria-label": `${Math.round(pct)} percent` }, h("span", { class: `w${Math.round(pct / 5) * 5}` })), h("span", {}, label));

export async function attendanceView(host, tab = "register") {
  stopAttendance();
  const admin = roleOf() === "owner" || roleOf() === "admin"; const s = state.school;
  const ui = { key: admin ? (localStorage.getItem("tb-att-class") || "") : state.profile.classTeacherKey, date: todayStr(), week: null, q: "" };
  if (!admin && !ui.key) return mount(host, h("h1", {}, "Attendance"), empty("No class assigned", "You are not a class teacher yet. Ask your school admin to assign you a class and arm."));
  const term = (await loadTerm(s.current.session, s.current.term).catch(() => null)) || {};
  const termStart = term.startDate, weeks = term.weeks || s.settings.weeks, atRisk = term.atRisk || s.settings.atRisk;
  const body = h("div", {}); const nav = h("div", { class: "subtabs", role: "tablist" }, [["register", "Register"], ["weekly", "Weekly"], ["term", "Term"], ["holidays", "Holidays"]].map(([id, l]) => h("a", { href: `#/${admin ? "admin" : "teacher"}/attendance/${id}`, role: "tab", "aria-selected": String(id === tab) }, l)));
  const picker = admin ? classPicker(s.structure, ui.key, { blank: "Choose a class" }) : null;
  if (picker) picker.addEventListener("change", () => { ui.key = picker.value; localStorage.setItem("tb-att-class", ui.key); load(); });
  mount(host, h("h1", {}, "Attendance"), picker ? h("div", { class: "toolbar" }, picker) : h("p", { class: "muted" }, classLabel(ui.key)), nav, body);
  if (tab === "holidays") return holidaysTab(body, admin);
  if (!termStart) return mount(body, empty("Set the term start date", admin ? "Open Setup and enter the term's start date (a Monday). Attendance weeks are counted from it." : "Your school admin needs to set the term start date first."));
  const data = { students: null, att: {}, hol: {} };
  ui.week = currentWeekIndex(termStart, weeks, todayStr());
  function load() {
    stopAttendance(); if (!ui.key) return mount(body, empty("Choose a class", "Pick a class and arm to open its register."));
    mount(body, skeleton(5));
    const end = dstr(addDays(parseD(termStart), weeks * 7));
    subs = [
      watchStudents((l) => { data.students = sortStudents((l || []).filter((x) => x.classKey === ui.key && isEnrolled(x))); draw(); }),
      watchAttendance(ui.key, termStart, end, (m) => { data.att = m || {}; draw(); }),
      watchHolidays((m) => { data.hol = m; draw(); }),
    ];
  }
  const hint = () => { const sync = document.getElementById("sync"); if (sync) sync.textContent = navigator.onLine ? "Synced" : "Offline"; };
  let timer; const marks = () => data.att;
  function setMark(date, sid, sess, val) {
    const day = (data.att[date] ||= {}); const m = (day[sid] ||= {}); if (val) m[sess] = true; else delete m[sess]; if (!m[AM] && !m[PM]) delete day[sid];
    clearTimeout(timer); timer = setTimeout(async () => { try { await saveAttendanceDay(ui.key, date, data.att[date] || {}, { session: s.current.session, term: s.current.term, class: ui.key.split("|")[0], arm: ui.key.split("|")[1] }); } catch (e) { toast(friendlyAuthError(e), "error"); } hint(); }, 350);
  }
  function draw() {
    if (!data.students) return; const st = data.students;
    if (!st.length) return mount(body, empty("No students in this class", "Add students under Students, then come back."));
    if (tab === "register") return register(st); if (tab === "weekly") return weekly(st); return termTab(st);
  }
  function register(st) {
    const d = ui.date, day = data.att[d] || {}, hol = data.hol[d], weekend = isWeekend(parseD(d));
    const tally = (sess) => st.filter((x) => day[x.id]?.[sess]).length;
    const q = ui.q.toLowerCase(); const row = (x, i) => h("div", { class: "reg-row" }, h("span", { class: "reg-name" }, h("span", { class: "avatar", "aria-hidden": "true" }, initials(x.name)), `${i + 1}. ${x.name}`),
      [AM, PM].map((sess) => h("label", { class: "sw" }, h("span", { class: "sr" }, `${x.name} ${sess === AM ? "AM" : "PM"}`), h("input", { type: "checkbox", checked: Boolean(day[x.id]?.[sess]), disabled: Boolean(hol) || weekend, onchange: (e) => { setMark(d, x.id, sess, e.target.checked); draw(); } }), h("i", {}))));
    const grp = (g, title) => { const l = st.filter((x) => x.gender === g); const vis = l.filter((x) => !q || x.name.toLowerCase().includes(q)); return l.length ? [h("h2", {}, title, h("span", { class: "count" }, l.length)), h("div", { class: "reg-list" }, vis.map((x) => row(x, l.indexOf(x))))] : null; };
    const dateIn = dateSelect({ id: "rd", label: "Register date", value: d, from: new Date().getFullYear() - 1, to: new Date().getFullYear() + 1 }); dateIn.addEventListener("change", () => { if (dateIn.value) { ui.date = dateIn.value; draw(); } });
    const setAll = (sess, v) => { st.forEach((x) => setMark(d, x.id, sess, v)); draw(); };
    mount(body, h("div", { class: "datebar" }, h("button", { class: "btn btn-icon", "aria-label": "Previous day", onclick: () => { ui.date = dstr(addDays(parseD(d), -1)); draw(); } }, "‹"), h("div", { class: "datebox" }, h("div", { class: "muted" }, showLong(d)), dateIn), h("button", { class: "btn btn-icon", "aria-label": "Next day", onclick: () => { ui.date = dstr(addDays(parseD(d), 1)); draw(); } }, "›"), h("button", { class: "btn btn-sm", onclick: () => { ui.date = todayStr(); draw(); } }, "Today")),
      h("p", { class: "muted" }, `Week ${currentWeekIndex(termStart, weeks, d)} of ${weeks} · ${st.length} students · `, h("span", { id: "sync", class: "chip" }, navigator.onLine ? "Synced" : "Offline")),
      hol ? h("p", { class: "banner banner-info" }, `Holiday${hol.label ? ": " + hol.label : ""}. No register today.`) : weekend ? h("p", { class: "banner banner-info" }, "Weekend. No register today.") : null,
      h("div", { class: "rings" }, ring(tally(AM), st.length, "AM present"), ring(tally(PM), st.length, "PM present")),
      h("div", { class: "toolbar" }, h("button", { class: "btn btn-sm", disabled: Boolean(hol) || weekend, onclick: () => setAll(AM, true) }, "All AM"), h("button", { class: "btn btn-sm", disabled: Boolean(hol) || weekend, onclick: () => setAll(PM, true) }, "All PM"),
        h("button", { class: "btn btn-sm btn-danger-quiet", disabled: Boolean(hol) || weekend, onclick: async () => { if (await confirmDialog({ title: "Clear this day?", body: "All AM and PM marks for this date will be removed.", confirmLabel: "Clear day", danger: true })) { st.forEach((x) => { setMark(d, x.id, AM, false); setMark(d, x.id, PM, false); }); draw(); } } }, "Clear day")),
      h("input", { type: "search", placeholder: "Search students", "aria-label": "Search students", value: ui.q, oninput: (e) => { ui.q = e.target.value; const pos = e.target.selectionStart; draw(); const n = body.querySelector("input[type=search]"); n.focus(); n.setSelectionRange(pos, pos); } }),
      h("div", { class: "reg-head", "aria-hidden": "true" }, h("span", {}, "Name"), h("span", {}, "AM"), h("span", {}, "PM")), grp("M", "Males"), grp("F", "Females"));
  }
  function weekly(st) {
    const sum = weekSummary({ students: st, attendance: data.att, holidays: data.hol, termStart, week: ui.week, today: todayStr() }); const wd = weekDates(termStart, ui.week);
    const sel = select(Array.from({ length: weeks }, (_, i) => { const w = weekDates(termStart, i + 1); return [String(i + 1), `Week ${i + 1} (${showDate(w[0]).slice(0, 5)} – ${showDate(w[4]).slice(0, 5)})`]; }), String(ui.week), { "aria-label": "Week", onchange: (e) => { ui.week = +e.target.value; draw(); } });
    const csv = [["#", "Gender", "Name", "Marks", "Max", "Percent"]]; const grp = (g, t) => { const rows = sum.groups[g].map(({ st: x, pts, pct }, i) => { csv.push([i + 1, t, x.name, pts, sum.maxPts, pct + "%"]); return h("tr", {}, h("td", {}, i + 1), h("td", {}, x.name), h("td", {}, bar(pct, `${pts}/${sum.maxPts}`, pct < atRisk))); }); return [h("h2", {}, t), h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, "Name"), h("th", {}, "Attendance"))), h("tbody", {}, rows)))]; };
    mount(body, h("div", { class: "toolbar" }, h("button", { class: "btn btn-icon", "aria-label": "Previous week", disabled: ui.week <= 1, onclick: () => { ui.week--; draw(); } }, "‹"), sel, h("button", { class: "btn btn-icon", "aria-label": "Next week", disabled: ui.week >= weeks, onclick: () => { ui.week++; draw(); } }, "›")),
      h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Day"), h("th", {}, "AM"), h("th", {}, "PM"), h("th", {}, "Total"))),
        h("tbody", {}, sum.days.map((x) => h("tr", {}, h("th", { scope: "row" }, showDate(x.ds).slice(0, 5) + " " + parseD(x.ds).toLocaleDateString("en-GB", { weekday: "short" })), x.kind === "holiday" ? h("td", { colspan: 3 }, h("span", { class: "tag" }, "Holiday" + (x.label ? ": " + x.label : ""))) : x.kind === "future" ? h("td", { colspan: 3, class: "muted" }, "Not yet") : [h("td", {}, x.m), h("td", {}, x.a), h("td", {}, x.m + x.a)]))),
        h("tfoot", {}, h("tr", {}, h("th", {}, "Week total"), h("td", {}, sum.wkM), h("td", {}, sum.wkA), h("td", {}, sum.actual))))),
      h("div", { class: "stats" }, h("div", { class: "stat" }, h("div", { class: "v" }, sum.schoolDays), h("div", { class: "l" }, "School days")), h("div", { class: "stat" }, h("div", { class: "v" }, sum.pct.toFixed(1) + "%"), h("div", { class: "l" }, "Week attendance"))),
      h("div", { class: "toolbar" }, h("h2", {}, "Per student"), h("button", { class: "btn btn-sm", onclick: () => downloadCsv(`week-${ui.week}-attendance.csv`, csv) }, "Export CSV")), grp("M", "Males"), grp("F", "Females"));
  }
  function termTab(st) {
    const t = termSummary({ students: st, attendance: data.att, holidays: data.hol, termStart, weeks, today: todayStr(), atRiskBelow: atRisk }); const csv = [["#", "Name", "Marks", "Max", "Percent"]];
    const rows = t.rows.map(({ st: x, pts, pct }, i) => { csv.push([i + 1, x.name, pts, t.maxPts, Math.round(pct) + "%"]); return h("tr", {}, h("td", {}, i + 1), h("td", {}, x.name, pct < atRisk ? h("span", { class: "tag tag-err" }, "At risk") : null), h("td", {}, bar(pct, Math.round(pct) + "%", pct < atRisk))); });
    mount(body, h("div", { class: "stats" }, h("div", { class: "stat" }, h("div", { class: "v" }, t.schoolDays), h("div", { class: "l" }, "School days")), h("div", { class: "stat" }, h("div", { class: "v" }, t.grandPct.toFixed(0) + "%"), h("div", { class: "l" }, "Class average")), h("div", { class: "stat" }, h("div", { class: "v" }, t.atRisk), h("div", { class: "l" }, `Below ${atRisk}%`))),
      h("p", { class: "muted" }, `School days so far: ${t.schoolDays} (weekends and holidays excluded, future dates not counted).`), h("div", { class: "toolbar" }, h("button", { class: "btn btn-sm", onclick: () => downloadCsv("term-attendance.csv", csv) }, "Export CSV")),
      h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, "Name"), h("th", {}, "Attendance"))), h("tbody", {}, rows))));
  }
  load();
}

async function holidaysTab(body, admin) {
  const date = dateSelect({ id: "hd", label: "Holiday date", from: new Date().getFullYear() - 1, to: new Date().getFullYear() + 2, order: "asc" }); const why = input({ placeholder: "Reason (optional)", "aria-label": "Reason" }); let hol = {}; const list = h("div", {});
  const draw = () => mount(list, Object.keys(hol).sort().length ? h("div", { class: "list" }, Object.keys(hol).sort().map((d) => h("div", { class: "row-card" }, h("div", {}, h("strong", {}, showLong(d)), h("div", { class: "hint" }, hol[d].label || "")), admin ? h("button", { class: "btn btn-sm btn-danger-quiet", onclick: () => removeHoliday(d).catch((e) => toast(friendlyAuthError(e), "error")) }, "Remove") : null))) : empty("No holidays", "Holidays are not counted as school days."));
  subs.push(watchHolidays((m) => { hol = m; draw(); }));
  const nat = h("div", {});
  if (admin) nationalHolidays().then((l) => { const todo = l.filter((x) => !hol[x.date]); if (todo.length) mount(nat, h("div", { class: "banner banner-info" }, h("p", {}, `${todo.length} national public holiday(s) published by the platform.`), h("button", { class: "btn btn-sm", onclick: async () => { for (const x of todo) await addHoliday(x.date, x.reason); toast("Added"); } }, "Accept all"))); });
  mount(body, admin ? h("div", { class: "card" }, h("h2", {}, "Add a holiday"), h("div", { class: "filters" }, date, why, h("button", { class: "btn btn-primary", onclick: async () => { const d = date.value; if (!d) return toast("Choose the day, month and year", "error"); try { await addHoliday(d, why.value.trim()); date.value = ""; why.value = ""; } catch (e) { toast(friendlyAuthError(e), "error"); } } }, "Add holiday"))) : null, nat, list);
}
