import { h, mount, toast, empty, field, skeleton, formDialog, confirmDialog } from "../lib/dom.js";
import { state } from "../lib/store.js";
import { publicSchools, linkChild, myChild, reportsForStudent, termId, currentSessionLabel, publicSchoolBranding, loadStudentAttendance, saveAbsenceNote, loadMyAbsenceNotes, deleteAbsenceNote, loadPrivateFor, saveParentPrivate } from "../lib/data.js";
import { input, select, msg, friendlyAuthError, loadNg } from "./common.js";
import { renderReportCard } from "./reportcard.js";
import { printNodes } from "./scores.js";
import { studentPanel } from "./progress.js";
import { FIELDS, GROUPS } from "../lib/studentFields.js";
import { weeklyAttendance, absentDays } from "../lib/progress.js";
import { barChart } from "../lib/charts.js";
import { dateSelect } from "../lib/datepick.js";
import { validPhone, showDate } from "../lib/dates.js";
import { LBL } from "../lib/scores.js";

const [Y] = currentSessionLabel().split("/").map(Number); const SESSIONS = [`${Y}/${Y + 1}`, `${Y - 1}/${Y}`];
const ui = { sel: 0, tab: "progress" };

/** Dialog to link a child with the school's admission number and access code. One account can link many children, at one school or several. */
async function linkDialog(onLinked) {
  const ng = await loadNg(); const schools = await publicSchools().catch(() => []);
  const st = select([["", "Choose state"], ...ng.map((x) => [x.name, x.name])], ""); const lga = select([["", "Choose local government"]], ""); const sch = select([["", "Choose school"]], "");
  st.addEventListener("change", () => { lga.replaceChildren(...[["", "Choose local government"], ...(ng.find((x) => x.name === st.value)?.lgas.map((x) => [x, x]) || [])].map(([v, t]) => h("option", { value: v }, t))); sch.replaceChildren(h("option", { value: "" }, "Choose school")); });
  lga.addEventListener("change", () => { const l = schools.filter((x) => x.state === st.value && x.lga === lga.value).sort((a, b) => a.name.localeCompare(b.name)); sch.replaceChildren(h("option", { value: "" }, l.length ? "Choose school" : "No verified schools here yet"), ...l.map((x) => h("option", { value: x.id }, x.name))); });
  const adm = input({ id: "ad" }); const code = input({ id: "cd", autocapitalize: "characters", autocomplete: "off" }); const out = h("p", { role: "alert", hidden: true });
  formDialog("Link a child", (close) => h("form", { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); if (!sch.value || !adm.value.trim() || !code.value.trim()) return msg(out, "Choose the school and enter the admission number and code.");
    try { const links = await linkChild({ schoolId: sch.value, admissionNo: adm.value.trim(), code: code.value.trim().toUpperCase() }); state.profile.links = links; toast("Child linked"); close("ok"); onLinked(links.length - 1); }
    catch (err) { msg(out, err?.code === "permission-denied" ? "That admission number and code do not match, or the access was revoked. Check them with the school." : friendlyAuthError(err)); }
  } }, h("p", { class: "muted" }, "Each child has their own admission number and access code from the school. You can link as many children as you have, even at different schools."),
    field("State", st), field("Local government", lga), field("School", sch), field("Admission number", adm), field("Access code", code), out,
    h("div", { class: "dlg-actions" }, h("button", { class: "btn", type: "button", onclick: () => close("no") }, "Cancel"), h("button", { class: "btn btn-primary", type: "submit" }, "Link child"))));
}

async function loadChild(link) {
  const [child, brand] = await Promise.all([myChild(link.schoolId, link).catch(() => null), publicSchoolBranding(link.schoolId)]);
  return { link, child, brand };
}
/** Published report cards for the latest session that has any, as { term: card }, plus every card for the list. */
async function loadCards(link) {
  for (const session of SESSIONS) { const reports = await reportsForStudent(link.schoolId, link.studentId, [3, 2, 1].map((t) => termId(session, t))); if (reports.length) { const byTerm = {}; reports.forEach((r) => (byTerm[r.term] = r.card)); return { session, byTerm, reports }; } }
  return { session: SESSIONS[0], byTerm: {}, reports: [] };
}

function detailsForm(link, child) {
  const out = h("p", { role: "status", hidden: true }); const inputs = {}; const host = h("div", {}); let ng = [];
  const priv = FIELDS.filter((f) => f.store === "private");
  const mk = (f) => { const id = `p_${f.key}`; let el;
    if (f.type === "textarea") el = h("textarea", { id, rows: 2 }); else if (f.type === "select") el = select([["", "Not given"], ...f.options.map((o) => [o, o])], "", { id });
    else if (f.type === "state") el = select([["", "Choose state"]], "", { id, onchange: () => fillLga("") }); else if (f.type === "lga") el = select([["", "Choose state first"]], "", { id });
    else el = input({ id, type: f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text", inputmode: f.type === "tel" ? "tel" : null }); inputs[f.key] = el; return el; };
  const fillLga = (keep) => { const l = ng.find((x) => x.name === inputs.stateOfOrigin.value)?.lgas || []; inputs.lgaOfOrigin.replaceChildren(...[["", "Choose local government"], ...l.map((x) => [x, x])].map(([v, t]) => h("option", { value: v, selected: v === keep }, t))); };
  priv.forEach(mk);
  const relOn = h("input", { type: "checkbox" }); const rel = select(["", "Christianity", "Islam", "Traditional", "Other", "Prefer not to say"], ""); rel.hidden = true; relOn.addEventListener("change", () => (rel.hidden = !relOn.checked));
  const group = (key, title, hint) => { const fs = priv.filter((f) => f.group === key); return fs.length ? h("fieldset", { class: "sect" }, h("legend", {}, title), hint ? h("p", { class: "hint" }, hint) : null, h("div", { class: "form-grid" }, fs.map((f) => { const w = field(f.label, inputs[f.key]); if (f.type === "textarea") w.classList.add("full"); return w; }))) : null; };
  Promise.all([loadNg(), loadPrivateFor(link.schoolId, link.studentId)]).then(([list, p]) => {
    ng = list; inputs.stateOfOrigin.replaceChildren(...[["", "Choose state"], ...ng.map((x) => [x.name, x.name])].map(([v, t]) => h("option", { value: v, selected: v === p.stateOfOrigin }, t))); fillLga(p.lgaOfOrigin || "");
    for (const f of priv) if (f.type !== "state" && f.type !== "lga") inputs[f.key].value = p[f.key] || ""; if (p.religion) { relOn.checked = true; rel.hidden = false; rel.value = p.religion; }
  });
  mount(host, h("form", { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); const values = {};
    for (const f of priv) { const v = String(inputs[f.key].value || "").trim(); if (v && f.type === "tel" && !validPhone(v)) return msg(out, `${f.label}: enter a valid Nigerian phone number.`); if (v && f.type === "email" && !/^\S+@\S+\.\S+$/.test(v)) return msg(out, `${f.label}: enter a valid email address.`); values[f.key] = f.type === "tel" ? v.replace(/[\s-]/g, "") : v; }
    values.religion = relOn.checked ? rel.value : "";
    try { await saveParentPrivate(link.schoolId, link.studentId, values); msg(out, "Saved. The school can see these details.", "ok"); } catch (err) { msg(out, friendlyAuthError(err)); }
  } }, h("p", { class: "muted" }, `Keep ${child.name}'s details up to date. Only the school admin and the class teacher can see them. Health details are sensitive: enter only what you are happy for the school to know.`),
    group("student", "About the child"), group("contact", "Parent or guardian (main contact)"), group("family", "Father and mother"), group("emergency", "Emergency contact", "Someone the school can call if you cannot be reached."),
    group("health", "Health", "Allergies, conditions and medicine the school should know about."), group("other", "Other"),
    h("label", { class: "chk" }, relOn, "Record religion (optional, sensitive)"), rel, out, h("div", { class: "stack-row" }, h("button", { class: "btn btn-primary", type: "submit" }, "Save details"))));
  void GROUPS; return host;
}

async function attendanceTab(link, child, cards) {
  const wrap = h("div", {}); const [rec, notes] = await Promise.all([loadStudentAttendance(link.schoolId, cards.session, link.studentId), loadMyAbsenceNotes(link.schoolId, link.studentId)]);
  const terms = [1, 2, 3].filter((t) => rec?.od?.[t]?.length); const term = terms[terms.length - 1] || 1; const wk = weeklyAttendance(rec, term);
  const draw = (notesNow) => {
    const date = dateSelect({ id: "an", label: "Date of absence", from: Y - 1, to: Y + 1 }); const reason = h("textarea", { rows: 2, id: "ar", placeholder: "For example: sick with malaria, family event" }); const out = h("p", { role: "status", hidden: true });
    const missed = absentDays(rec, term);
    mount(wrap, wk.labels.length ? [h("div", { class: "kpis" }, h("div", { class: "kpi" }, h("div", { class: "kpi-l" }, `Attendance, ${LBL[term]}`), h("div", { class: "kpi-v" }, `${wk.pct}%`), h("div", { class: "hint" }, `${wk.present} of ${wk.opened} marks`)), h("div", { class: "kpi" }, h("div", { class: "kpi-l" }, "Days missed"), h("div", { class: "kpi-v" }, String(missed.length)))),
      barChart({ title: `Attendance by week, ${LBL[term]}`, items: wk.labels.map((l, i) => ({ label: l, value: wk.values[i], cls: wk.values[i] !== null && wk.values[i] < 75 ? 5 : 2 })), max: 100, unit: "%" })] : empty("No attendance yet", "The class teacher's register will show here once it is taken."),
      missed.length ? h("div", { class: "hl" }, h("h3", {}, "Days missed"), h("ul", { class: "cols" }, missed.slice(-16).map((a) => h("li", {}, `${showDate(a.date)}${a.marks ? " (half day)" : ""}`)))) : null,
      h("form", { class: "card", novalidate: true, onsubmit: async (e) => { e.preventDefault(); if (!date.value) return msg(out, "Choose the date."); if (!reason.value.trim()) return msg(out, "Write the reason."); try { await saveAbsenceNote(link.schoolId, child, date.value, reason.value.trim()); msg(out, "Sent to the class teacher.", "ok"); draw(await loadMyAbsenceNotes(link.schoolId, link.studentId)); } catch (err) { msg(out, friendlyAuthError(err)); } } },
        h("h2", {}, "Tell the teacher about an absence"), h("p", { class: "muted" }, "Your note appears next to your child's name on the class register. It does not change the attendance marks."), field("Date", date), field("Reason", reason), out, h("button", { class: "btn btn-primary", type: "submit" }, "Send note")),
      notesNow.length ? h("div", { class: "list" }, notesNow.map((n) => h("div", { class: "row-card" }, h("div", {}, h("strong", {}, showDate(n.date)), h("div", { class: "hint" }, n.reason)), h("button", { class: "btn btn-sm btn-danger-quiet", onclick: async () => { await deleteAbsenceNote(link.schoolId, n.id); draw(await loadMyAbsenceNotes(link.schoolId, link.studentId)); } }, "Remove")))) : null);
  };
  draw(notes); return wrap;
}

export async function parentView(host) {
  mount(host, h("h1", {}, "My children"), skeleton(3)); const links = state.profile.links || [];
  const refresh = (sel) => { if (sel !== undefined) ui.sel = sel; parentView(host); };
  if (!links.length) return mount(host, h("h1", {}, "My children"), empty("No child linked yet", "Ask your child's school for the admission number and access code, then link your child.", h("button", { class: "btn btn-primary", onclick: () => linkDialog(refresh) }, "Link a child")));
  const loaded = await Promise.all(links.map(loadChild)); ui.sel = Math.min(ui.sel, loaded.length - 1); const cur = loaded[ui.sel]; const schools = new Set(loaded.map((x) => x.link.schoolId)).size > 1;
  const chips = h("div", { class: "chips", role: "tablist", "aria-label": "Children" }, loaded.map((x, i) => h("button", { role: "tab", "aria-selected": String(i === ui.sel), onclick: () => { ui.sel = i; ui.tab = "progress"; parentView(host); } }, x.child ? x.child.name : x.link.admissionNo, schools && x.brand.name ? h("small", {}, x.brand.name) : null)));
  const head = h("div", { class: "toolbar" }, h("h1", { class: "grow" }, "My children"), h("button", { class: "btn btn-primary", onclick: () => linkDialog(refresh) }, "Link another child"));
  if (!cur.child) return mount(host, head, chips, h("div", { class: "card" }, h("p", {}, `Access to admission number ${cur.link.admissionNo} is no longer available. Ask the school for a new code.`)));
  const child = cur.child, link = cur.link; const tabs = [["progress", "Progress"], ["reports", "Report cards"], ["attendance", "Attendance"], ["details", "Details"]];
  const body = h("div", {}); const tabBar = h("div", { class: "subtabs", role: "tablist" }, tabs.map(([id, l]) => h("button", { class: "tabbtn", role: "tab", "aria-selected": String(ui.tab === id), onclick: () => { ui.tab = id; parentView(host); } }, l)));
  mount(host, head, chips, h("div", { class: "child-head card" }, h("span", { class: "avatar big", "aria-hidden": "true" }, (child.name || "?").slice(0, 1)), h("div", {}, h("strong", {}, child.name), h("div", { class: "hint" }, `${child.class}${child.arm ? " " + child.arm : ""} · Admission no. ${child.admissionNo}${cur.brand.name ? " · " + cur.brand.name : ""}`))), tabBar, body, skeleton(2));
  try {
    const cards = ui.tab === "details" ? null : await loadCards(link);
    if (ui.tab === "progress") { const [rec, notes] = await Promise.all([loadStudentAttendance(link.schoolId, cards.session, link.studentId), loadMyAbsenceNotes(link.schoolId, link.studentId)]); mount(body, studentPanel({ name: child.name, cardsByTerm: cards.byTerm, attendance: rec, notes, mode: "parent" })); }
    else if (ui.tab === "reports") mount(body, cards.reports.length ? cards.reports.map((r) => h("div", { class: "rc-scroll" }, renderReportCard(r.card, cur.brand), h("button", { class: "btn btn-sm btn-primary", onclick: () => printNodes([renderReportCard(r.card, cur.brand)]) }, "Print / save as PDF"))) : empty("No report cards yet", "Report cards appear here after the school publishes the term."));
    else if (ui.tab === "attendance") mount(body, await attendanceTab(link, child, cards));
    else mount(body, detailsForm(link, child));
  } catch (e) { mount(body, empty("Cannot load", friendlyAuthError(e))); }
  void confirmDialog;
}
