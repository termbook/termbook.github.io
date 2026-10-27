import { h, mount, toast, confirmDialog, formDialog, field, empty, skeleton, downloadCsv, initials } from "../lib/dom.js";
import { state, roleOf, effectiveSchoolId } from "../lib/store.js";
import { watchStudents, addStudent, addStudents, updateStudent, bulkStudentAction, loadPrivate, issueAccessCode, revokeAccess, loadAccessCode, studentIdFor } from "../lib/data.js";
import { STATUS, LEFT_REASONS, classKey, promotionTarget, findDuplicates, filterStudents, parseStudentRows, parseStudentTable, readStudentFile, TEMPLATE_HEADERS, makeAdmissionNo, makeAccessCode, normName } from "../lib/students.js";
import { input, select, classPicker, allArms, classLabel, friendlyAuthError, loadNg } from "./common.js";
import { FIELDS, fieldByKey, splitExtra } from "../lib/studentFields.js";
import { armsOf } from "../lib/structure.js";
import { showDate, validPhone } from "../lib/dates.js";
import { dateSelect } from "../lib/datepick.js";
import { autoParent } from "../lib/attendance.js";

const PAGE = 50;
let unsub = null;

export function studentsView(host) {
  const isAdmin = roleOf() === "owner" || roleOf() === "admin";
  const structure = state.school.structure; const ui = { q: "", cls: "", arm: "", status: "active", deleted: false, page: 0, sel: new Set() };
  let all = null;
  const body = h("div", {}); mount(host, h("h1", {}, "Students"), body);
  const teacherKeys = new Set(state.profile?.classKeys || []);
  const canAdd = isAdmin || Boolean(state.profile?.classTeacherKey);
  const addKeys = isAdmin ? null : state.profile?.classTeacherKey;

  // Filter controls are built once, so typing in the search box is never interrupted by a redraw.
  const search = h("input", { type: "search", placeholder: "Search by name or admission number", "aria-label": "Search students", value: ui.q, oninput: (e) => { ui.q = e.target.value; ui.page = 0; clearTimeout(search.t); search.t = setTimeout(drawList, 150); } });
  const clsSel = select([["", "All classes"], ...structure.classes.map((c) => [c.name, c.name])], ui.cls, { "aria-label": "Class", onchange: (e) => { ui.cls = e.target.value; ui.arm = ""; ui.page = 0; fillArms(); drawList(); } });
  const armSel = select([["", "All arms"]], "", { "aria-label": "Arm or section", onchange: (e) => { ui.arm = e.target.value; ui.page = 0; drawList(); } });
  const fillArms = () => { const arms = ui.cls ? (structure.classes.find((c) => c.name === ui.cls)?.arms || []) : [...new Set(structure.classes.flatMap((c) => c.arms || []))]; armSel.replaceChildren(...[["", "All arms"], ...arms.map((a) => [a, a])].map(([v2, l]) => h("option", { value: v2, selected: v2 === ui.arm }, l))); };
  const statusSel = select([["active", "Active"]], ui.status, { "aria-label": "Status", onchange: (e) => { ui.status = e.target.value; ui.page = 0; drawList(); } });
  const delChk = h("input", { type: "checkbox", onchange: (e) => { ui.deleted = e.target.checked; ui.sel.clear(); drawList(); } });
  const listHost = h("div", {}); fillArms();
  mount(body, h("div", { class: "toolbar" }, canAdd ? h("button", { class: "btn btn-primary", type: "button", onclick: () => editDialog(null) }, "Add student") : null,
      canAdd ? h("button", { class: "btn", type: "button", onclick: bulkAddDialog }, "Paste or import list") : null,
      canAdd ? h("button", { class: "btn", type: "button", onclick: () => downloadCsv("students-template.csv", [TEMPLATE_HEADERS]) }, "Download template") : null,
      h("button", { class: "btn", type: "button", onclick: () => exportCsv(currentRows()) }, "Export CSV")),
    h("div", { class: "filters" }, search, clsSel, armSel, statusSel, isAdmin ? h("label", { class: "chk" }, delChk, "Show removed") : null), listHost);
  const currentRows = () => filterStudents(all || [], { q: ui.q, cls: ui.cls, arm: ui.arm, status: ui.status, showDeleted: ui.deleted }).sort((x, y) => x.name.localeCompare(y.name));
  function draw() {
    const counts = { active: 0, pending: 0, left: 0, graduated: 0 }; all.filter((s) => !s.deleted).forEach((s) => (counts[s.status] = (counts[s.status] || 0) + 1));
    statusSel.replaceChildren(...[["active", `Active (${counts.active})`], ["pending", `Pending (${counts.pending})`], ["left", `No longer in school (${counts.left})`], ["graduated", `Graduated (${counts.graduated})`], ["all", "All statuses"]].map(([v2, l]) => h("option", { value: v2, selected: v2 === ui.status }, l)));
    drawList();
  }
  function drawList() {
    const rows = currentRows(); const pages = Math.max(1, Math.ceil(rows.length / PAGE)); ui.page = Math.min(ui.page, pages - 1);
    const view = rows.slice(ui.page * PAGE, ui.page * PAGE + PAGE);
    const selected = [...ui.sel].filter((id) => all.some((s) => s.id === id));
    const bar = isAdmin ? h("div", { class: "bulk", role: "toolbar", "aria-label": "Actions for selected students" },
      h("strong", {}, `${selected.length} selected`),
      ui.deleted ? h("button", { class: "btn btn-sm", disabled: !selected.length, onclick: () => act("restore", selected) }, "Restore") : [
        h("button", { class: "btn btn-sm", disabled: !selected.length, onclick: () => act("promote", selected) }, "Promote"),
        h("button", { class: "btn btn-sm", disabled: !selected.length, onclick: () => act("move", selected) }, "Move to class"),
        h("button", { class: "btn btn-sm", disabled: !selected.length, onclick: () => act("left", selected) }, "No longer in school"),
        ui.status === "left" || ui.status === "graduated" ? h("button", { class: "btn btn-sm", disabled: !selected.length, onclick: () => act("reactivate", selected) }, "Back in school") : null,
        ui.status === "pending" ? h("button", { class: "btn btn-sm btn-primary", disabled: !selected.length, onclick: () => act("approve", selected) }, "Approve") : null,
        h("button", { class: "btn btn-sm btn-danger-quiet", disabled: !selected.length, onclick: () => act("remove", selected) }, "Remove")]) : null;
    const table = rows.length ? h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, isAdmin ? h("th", { scope: "col" }, h("input", { type: "checkbox", "aria-label": "Select all on this page", checked: view.length > 0 && view.every((s) => ui.sel.has(s.id)), onchange: (e) => { view.forEach((s) => (e.target.checked ? ui.sel.add(s.id) : ui.sel.delete(s.id))); drawList(); } })) : null, h("th", { scope: "col" }, "Name"), h("th", { scope: "col" }, "Class"), h("th", { scope: "col" }, "Admission no."), h("th", { scope: "col" }, "Status"), h("th", { scope: "col" }, ""))),
      h("tbody", {}, view.map((s) => h("tr", { class: s.deleted ? "deleted" : "" },
        isAdmin ? h("td", {}, h("input", { type: "checkbox", "aria-label": `Select ${s.name}`, checked: ui.sel.has(s.id), onchange: (e) => { e.target.checked ? ui.sel.add(s.id) : ui.sel.delete(s.id); drawList(); } })) : null,
        h("td", {}, h("span", { class: "avatar", "aria-hidden": "true" }, initials(s.name)), s.name, s.repeater ? h("span", { class: "tag tag-warn" }, "Repeater") : null),
        h("td", {}, classLabel(s.classKey || "")), h("td", {}, s.admissionNo),
        h("td", {}, h("span", { class: `tag tag-${s.deleted ? "err" : s.status}` }, s.deleted ? "Removed" : STATUS[s.status] || s.status), s.status === "left" && s.leftReason ? h("div", { class: "hint" }, s.leftReason + (s.leftOn ? ` (${showDate(s.leftOn)})` : "")) : null),
        h("td", {}, h("button", { class: "btn btn-sm", type: "button", onclick: () => editDialog(s) }, "Open")))))))
      : empty("No students match", ui.status === "active" && !all.length ? "Add students one by one or paste a list to get started." : "Try a different search or filter.");
    const pager = pages > 1 ? h("div", { class: "pager" }, h("button", { class: "btn btn-sm", disabled: ui.page === 0, onclick: () => { ui.page--; drawList(); } }, "Previous"), h("span", {}, `Page ${ui.page + 1} of ${pages} (${rows.length} students)`), h("button", { class: "btn btn-sm", disabled: ui.page >= pages - 1, onclick: () => { ui.page++; drawList(); } }, "Next")) : h("p", { class: "muted" }, `${rows.length} student${rows.length === 1 ? "" : "s"}`);
    mount(listHost, bar, table, pager);
  }

  function exportCsv(rows) { downloadCsv("students.csv", [["Name", "Gender", "Class", "Arm", "Admission no.", "Status", "Repeater", "Date of birth"], ...rows.map((s) => [s.name, s.gender, s.class, s.arm, s.admissionNo, STATUS[s.status] || s.status, s.repeater ? "Yes" : "", showDate(s.dob)])]); }

  async function act(action, ids) {
    const list = all.filter((s) => ids.includes(s.id)); const n = list.length; const date = new Date().toISOString().slice(0, 10);
    try {
      if (action === "promote") {
        const targets = {}; list.forEach((s) => { const t = promotionTarget(s, structure); if (t) targets[s.id] = t; });
        const grads = Object.values(targets).filter((t) => t.graduate).length; const skip = n - Object.keys(targets).length;
        if (!Object.keys(targets).length) return toast("None of the selected students can be promoted (check their class).", "error");
        const ok = await confirmDialog({ title: `Promote ${Object.keys(targets).length} student(s)?`, body: `Each moves to the next class (same arm where it exists).${grads ? ` ${grads} in SS3 will be marked Graduated.` : ""}${skip ? ` ${skip} cannot be promoted and are left unchanged.` : ""} Past attendance and scores stay in the history.`, confirmLabel: "Promote" });
        if (!ok) return; await bulkStudentAction(ids.filter((id) => targets[id]), "promote", { targets, date }, all); toast("Promoted");
      } else if (action === "move") {
        const sel = classPicker(structure, ""); const d = formDialog("Move to class", (close) => h("div", {}, field("New class and arm", sel), h("div", { class: "dlg-actions" }, h("button", { class: "btn", onclick: () => close("no") }, "Cancel"), h("button", { class: "btn btn-primary", onclick: () => close("yes") }, "Move"))));
        await new Promise((r) => d.addEventListener("close", r)); if (d.returnValue !== "yes" || !sel.value) return; const [c, a] = sel.value.split("|");
        await bulkStudentAction(ids, "move", { class: c, arm: a }, all); toast(`Moved ${n} student(s)`);
      } else if (action === "left") {
        const reason = select(LEFT_REASONS, LEFT_REASONS[0]); const d = formDialog("Mark as no longer in school", (close) => h("div", {}, h("p", {}, `${n} student(s) stay in the history but disappear from registers and score sheets.`), field("Reason", reason), h("div", { class: "dlg-actions" }, h("button", { class: "btn", onclick: () => close("no") }, "Cancel"), h("button", { class: "btn btn-primary", onclick: () => close("yes") }, "Mark as left"))));
        await new Promise((r) => d.addEventListener("close", r)); if (d.returnValue !== "yes") return; await bulkStudentAction(ids, "left", { reason: reason.value, date }, all); toast("Marked as no longer in school");
      } else if (action === "remove") {
        if (!await confirmDialog({ title: `Remove ${n} student(s)?`, body: "Removed students are hidden everywhere but can be restored by an admin. Use 'No longer in school' for students who have left.", confirmLabel: "Remove", danger: true })) return;
        await bulkStudentAction(ids, "remove", { date }, all); toast("Removed");
      } else { await bulkStudentAction(ids, action, { date }, all); toast("Done"); }
      ui.sel.clear();
    } catch (e) { toast(friendlyAuthError(e), "error"); }
  }

  function editDialog(s) {
    const isNew = !s; const keyDefault = ui.cls ? classKey(ui.cls, armsOf(structure.classes.find((c) => c.name === ui.cls))[0]) : "";
    const mine = isNew || isAdmin || s.classKey === addKeys; // class teachers edit only their own class
    const showPrivate = isAdmin || (isNew ? Boolean(addKeys) : s.classKey === addKeys);
    const controls = []; const track = (el) => (controls.push(el), el);
    const name = track(input({ id: "n", value: s?.name || "" })); const gender = track(select([["M", "Male"], ["F", "Female"]], s?.gender || "M"));
    const adm = input({ id: "a", value: s?.admissionNo || "", disabled: !mine, placeholder: isNew ? "Leave blank to generate one" : "" });
    const cp = addKeys ? h("input", { value: classLabel(addKeys), disabled: true, id: "cp" }) : track(classPicker(structure, s?.classKey || keyDefault));
    const rep = track(h("input", { type: "checkbox", checked: Boolean(s?.repeater) })); const yr = new Date().getFullYear(); const dob = track(dateSelect({ id: "d", label: "Date of birth", value: s?.dob || "", from: yr - 30, to: yr - 2 }));
    const statusSel = isAdmin && !isNew ? track(select(Object.entries(STATUS), s.status)) : null;
    const relOn = track(h("input", { type: "checkbox" })); const rel = track(select(["", "Christianity", "Islam", "Traditional", "Other", "Prefer not to say"], "")); rel.hidden = true; relOn.addEventListener("change", () => (rel.hidden = !relOn.checked));
    // Every other detail comes from the shared field list, so the form and the template always match.
    const inputs = {}; let ng = [];
    const stateSel = () => inputs.stateOfOrigin, lgaSel = () => inputs.lgaOfOrigin;
    const fillLga = (keep) => { const l = ng.find((x) => x.name === stateSel().value)?.lgas || []; lgaSel().replaceChildren(...[["", "Choose local government"], ...l.map((x) => [x, x])].map(([v2, t]) => h("option", { value: v2, selected: v2 === keep }, t))); };
    for (const f of FIELDS) {
      const id = "f_" + f.key; let el;
      if (f.type === "textarea") el = h("textarea", { id, rows: 2 });
      else if (f.type === "select") el = select([["", "Not given"], ...f.options.map((o) => [o, o])], "", { id });
      else if (f.key === "category") el = select([["", "None"], ...(structure.departments || []).map((x) => [x, x])], "", { id });
      else if (f.type === "state") el = select([["", "Choose state"]], "", { id, onchange: () => fillLga("") });
      else if (f.type === "lga") el = select([["", "Choose state first"]], "", { id });
      else if (f.type === "date") el = dateSelect({ id, label: f.label, from: new Date().getFullYear() - 12, to: new Date().getFullYear() + 1 });
      else el = input({ id, type: f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text", placeholder: f.type === "tel" ? "08031234567" : "", inputmode: f.type === "tel" ? "tel" : null });
      inputs[f.key] = track(el);
    }
    loadNg().then((list) => { ng = list; stateSel().replaceChildren(...[["", "Choose state"], ...ng.map((x) => [x.name, x.name])].map(([v2, t]) => h("option", { value: v2, selected: v2 === stateSel().dataset.v }, t))); fillLga(lgaSel().dataset.v || ""); });
    const setVal = (key, val) => { const el = inputs[key]; if (!el) return; const f = fieldByKey(key); const v2 = val || ""; if (key === "category" && v2 && ![...el.options].some((o) => o.value === v2)) el.append(h("option", { value: v2 }, v2)); el.value = v2; if (f.type === "state" || f.type === "lga") el.dataset.v = v2; };
    if (s) { setVal("admissionDate", s.admissionDate); setVal("parentName", s.parentName); }
    if (s && showPrivate) loadPrivate(s.id).then((p) => { for (const f of FIELDS) if (f.store === "private") setVal(f.key, p[f.key]); if (p.religion) { relOn.checked = true; rel.hidden = false; rel.value = p.religion; } if (ng.length) { stateSel().value = p.stateOfOrigin || ""; fillLga(p.lgaOfOrigin || ""); } });
    if (isNew) setVal("nationality", "Nigerian");
    const out = h("p", { class: "form-msg", role: "alert", hidden: true }); const codeBox = h("div", {});
    if (s && isAdmin) renderCode();
    async function renderCode() {
      const c = await loadAccessCode(s.id).catch(() => null);
      mount(codeBox, h("h3", {}, "Parent access code"), c?.active ? h("p", {}, "Code: ", h("strong", { class: "code" }, c.code), " Share it with the parent, together with the admission number.") : h("p", { class: "muted" }, "No active code."),
        h("div", { class: "stack-row" }, h("button", { class: "btn btn-sm", type: "button", onclick: async () => { await issueAccessCode(s, makeAccessCode()); renderCode(); } }, c?.active ? "Replace code" : "Create code"),
          c?.active ? h("button", { class: "btn btn-sm btn-danger-quiet", type: "button", onclick: async () => { if (await confirmDialog({ title: "Revoke parent access?", body: "The code stops working and any linked parent loses access.", confirmLabel: "Revoke", danger: true })) { await revokeAccess(s); renderCode(); } } }, "Revoke access") : null));
    }
    const save = h("button", { class: "btn btn-primary", type: "submit" }, isNew ? "Add student" : "Save changes");
    if (!mine) { [...controls, rel].forEach((x) => (x.disabled = true)); save.disabled = true; }
    const sect = (key, title, hint, priv) => {
      const fs = FIELDS.filter((f) => f.group === key);
      return h("fieldset", { class: `sect${priv ? " sect-private" : ""}` }, h("legend", {}, title), hint ? h("p", { class: "hint" }, hint) : null,
        h("div", { class: "form-grid" }, fs.map((f) => { const wrap = field(f.label, inputs[f.key]); if (f.type === "textarea") wrap.classList.add("full"); return wrap; }),
          key === "contact" ? h("div", { class: "field" }, h("label", { for: "ap" }, "Fill the name from the student's surname"), h("button", { id: "ap", class: "btn btn-sm", type: "button", onclick: () => (inputs.parentName.value = autoParent(name.value)) }, "Auto-fill")) : null));
    };
    formDialog(isNew ? "Add student" : s.name, (close) => h("form", { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); out.hidden = true; const nm = normName(name.value); const key = addKeys || cp.value;
      const fail = (t) => { out.textContent = t; out.className = "form-msg error"; out.hidden = false; out.scrollIntoView({ block: "nearest" }); };
      if (!nm) return fail("Enter the student's name (surname first)."); if (!key) return fail("Choose a class and arm.");
      if (dob.partial) return fail("Choose the day, month and year of the date of birth, or clear all three.");
      if (!isNew && mine) { const nn = adm.value.trim(); if (!nn) return fail("The admission number cannot be empty."); if (nn !== s.admissionNo && all.some((x) => x.id !== s.id && x.admissionNo === nn)) return fail("Another student already has that admission number."); }
      const stuExtra = {}, priv = {};
      for (const f of FIELDS) {
        const raw = String(inputs[f.key].value || "").trim(); let val = raw;
        if (raw && f.type === "tel") { if (!validPhone(raw)) return fail(`${f.label}: enter a valid Nigerian phone number.`); val = raw.replace(/[\s-]/g, ""); }
        if (raw && f.type === "email" && !/^\S+@\S+\.\S+$/.test(raw)) return fail(`${f.label}: enter a valid email address.`);
        if (f.type === "date" && inputs[f.key].partial) return fail(`${f.label}: choose the day, month and year, or clear all three.`);
        if (f.store === "student") stuExtra[f.key] = val; else if (showPrivate) priv[f.key] = val;
      }
      if (showPrivate) priv.religion = relOn.checked ? rel.value : "";
      const [c, a] = key.split("|"); const taken = new Set(all.map((x) => x.admissionNo)); const admNo = adm.value.trim() || s?.admissionNo || makeAdmissionNo(taken);
      const rec = { name: nm, gender: gender.value, class: c, arm: a, repeater: rep.checked, dob: dob.value, ...stuExtra };
      try {
        if (isNew) {
          const dups = findDuplicates(all, { ...rec, admissionNo: admNo, classKey: key });
          if (dups.length && !await confirmDialog({ title: "Possible duplicate", body: `${dups[0].name} (${classLabel(dups[0].classKey)}, ${dups[0].admissionNo}) looks like this student. Add anyway?`, confirmLabel: "Add anyway" })) return;
          await addStudent({ ...rec, admissionNo: admNo, status: isAdmin ? "active" : "pending" }, showPrivate ? priv : null); toast(isAdmin ? "Student added" : "Student added. The admin will confirm.");
        } else {
          if (statusSel) rec.status = statusSel.value;
          if (mine) rec.admissionNo = adm.value.trim();
          if (rec.name !== s.name) { const dups = findDuplicates(all, { ...rec, id: s.id, admissionNo: "", classKey: s.classKey }); if (dups.length && !await confirmDialog({ title: "Same name in this class", body: `${dups[0].name} is already in ${classLabel(dups[0].classKey)}. Save the new name anyway?`, confirmLabel: "Save anyway" })) return; }
          await updateStudent(s.id, rec, showPrivate ? priv : null, s); toast("Saved");
        }
        close("ok");
      } catch (err) { fail(friendlyAuthError(err)); }
    } },
      h("div", {},
        h("fieldset", { class: "sect" }, h("legend", {}, "Student details"), h("div", { class: "form-grid" },
          field("Full name (surname first)", name), field("Gender", gender), field(addKeys ? "Class (yours)" : "Class and arm", cp),
          field("Admission number", adm, isNew ? "You can correct it later if it is wrong." : mine ? "Correcting it keeps the student's attendance, scores and parent access. Tell the parent the new number." : "You can view this student, but only their class teacher or the admin can edit."),
          field("Date of birth", dob), statusSel ? field("Status", statusSel) : null,
          FIELDS.filter((f) => f.group === "student").map((f) => { if (f.store === "private" && !showPrivate) return null; const w = field(f.label, inputs[f.key]); if (f.type === "textarea") w.classList.add("full"); return w; }),
          h("div", { class: "field" }, h("label", { class: "chk" }, rep, "Repeater"))),
          showPrivate ? h("div", {}, h("label", { class: "chk" }, relOn, "Record religion (optional, sensitive)"), rel) : null)),
      showPrivate ? [sect("contact", "Parent or guardian (main contact)", "Visible to the school admin and this class's teacher only.", true), sect("family", "Father and mother (optional)", null, true), sect("emergency", "Emergency contact", "Someone to call if the parent cannot be reached.", true),
        sect("health", "Health (private)", "Optional. Health information is sensitive: only the school admin and this class's teacher can see it. Enter only what the family has told the school.", true), sect("other", "Other", null, true)] : null,
      out, isAdmin && s ? codeBox : null,
      h("div", { class: "dlg-actions sticky" }, h("button", { class: "btn", type: "button", onclick: () => close("no") }, "Cancel"), save)), true);
  }

  function bulkAddDialog() {
    const cp = addKeys ? h("input", { value: classLabel(addKeys), disabled: true, "aria-label": "Class" }) : classPicker(structure, "", { blank: "Class and arm (used when the file has none)" });
    const ta = h("textarea", { rows: 6, placeholder: "Or type or paste here, one student per line:\nADEBAYO Temitope, F\nBELLO Aminat, F, 2026/00123, R", "aria-label": "Student list" });
    let fileRows = null; const info = h("div", { class: "fileinfo", hidden: true, "aria-live": "polite" });
    const out = h("p", { class: "form-msg", role: "alert", hidden: true });
    const fail = (t) => { out.textContent = t; out.className = "form-msg error"; out.hidden = false; };
    const file = h("input", { type: "file", accept: ".csv,.txt,.xlsx,.xls,text/csv", "aria-label": "Choose a CSV or Excel file", onchange: async (e) => {
      out.hidden = true; const f = e.target.files[0]; if (!f) return;
      try { const table = await readStudentFile(f); fileRows = parseStudentTable(table); ta.value = ""; showInfo(f.name); } catch { fileRows = null; info.hidden = true; fail("Could not read that file. Save it as CSV or Excel and try again."); }
    } });
    const rowsNow = () => fileRows || parseStudentRows(ta.value);
    function showInfo(name) {
      const r = fileRows; const noGender = r.filter((x) => !x.gender).length, badDob = r.filter((x) => x.dobBad).length;
      const bad = {}; r.forEach((x) => (x.badFields || []).forEach((l) => (bad[l] = (bad[l] || 0) + 1)));
      const withDetails = r.filter((x) => Object.keys(x.extra || {}).length).length;
      const problems = [noGender && `${noGender} without a gender (they will be set to Male: fix them afterwards)`, badDob && `${badDob} with a date of birth that is not DD/MM/YYYY (left blank)`, ...Object.entries(bad).map(([l, n]) => `${n} with "${l}" that could not be read (left blank)`)].filter(Boolean);
      mount(info, h("p", {}, h("strong", {}, `${name}: ${r.length} student${r.length === 1 ? "" : "s"} found`), withDetails ? ` · ${withDetails} with family, health or other details` : ""), problems.length ? h("ul", {}, problems.map((x) => h("li", {}, x))) : h("p", { class: "muted" }, "Everything in the file was read correctly."),
        h("button", { class: "btn btn-sm", type: "button", onclick: () => { fileRows = null; file.value = ""; info.hidden = true; } }, "Remove file")); info.hidden = false;
    }
    const validKey = (c, a) => structure.classes.some((x) => x.name === c && armsOf(x).includes(a || "")) ? classKey(c, a || "") : "";
    formDialog("Add many students", (close) => h("form", { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); out.hidden = true; const rows = rowsNow(); if (!rows.length) return fail("Choose a file or type at least one name.");
      const dlg = addKeys || cp.value; const taken = new Set(all.map((x) => x.admissionNo)); const list = [], skipped = [], wrongClass = [];
      for (const r of rows) {
        const key = (r.class ? validKey(r.class, r.arm) : "") || dlg;
        if (!key) { wrongClass.push(r.name); continue; } if (addKeys && key !== addKeys) { wrongClass.push(r.name); continue; }
        if (r.admissionNo && taken.has(r.admissionNo)) { skipped.push(r.name); continue; }
        const adm = r.admissionNo || makeAdmissionNo(taken); taken.add(adm); const [c, a] = key.split("|");
        const { student: stuX, priv: privX } = splitExtra(r.extra || {}); if (stuX.category) stuX.category = (structure.departments || []).find((d) => d.toLowerCase() === stuX.category.toLowerCase()) || stuX.category;
        list.push({ name: r.name, gender: r.gender || "M", repeater: Boolean(r.repeater), admissionNo: adm, class: c, arm: a, status: isAdmin ? "active" : "pending", dob: r.dob || "", parentName: "", ...stuX, _priv: privX });
      }
      if (!list.length) return fail(wrongClass.length ? "No students could be placed. Choose a class and arm, or check the Class and Arm columns." : "Nothing to add.");
      const notes = [skipped.length && `${skipped.length} skipped because the admission number already exists.`, wrongClass.length && `${wrongClass.length} skipped because their class or arm ${addKeys ? "is not your class" : "is missing or not in your school's list"}.`, !isAdmin && "They will wait for the admin to confirm."].filter(Boolean).join(" ");
      if (!await confirmDialog({ title: `Add ${list.length} student(s)?`, body: notes || "Check the list, then confirm.", confirmLabel: "Add" })) return;
      try { await addStudents(list); toast(`${list.length} students added`); close("ok"); } catch (err) { fail(friendlyAuthError(err)); }
    } }, h("p", { class: "muted" }, "Choose the filled students file (CSV or Excel). It is read exactly as saved: every column of the template is picked up by its heading, including family, emergency contact, health and other details. Columns you leave out are simply skipped."),
      h("p", {}, h("button", { class: "btn btn-sm", type: "button", onclick: () => downloadCsv("students-template.csv", [TEMPLATE_HEADERS]) }, "Download the blank template")),
      field("Student file", file), info, field("Class and arm", cp, "Used for any student whose row has no valid Class and Arm."), ta, out,
      h("div", { class: "dlg-actions" }, h("button", { class: "btn", type: "button", onclick: () => close("no") }, "Cancel"), h("button", { class: "btn btn-primary", type: "submit" }, "Review and add"))));
  }

  mount(listHost, skeleton(5));
  unsub?.(); unsub = watchStudents((list, err) => { if (err) return mount(listHost, empty("Cannot load students", friendlyAuthError(err))); state.students = list; all = list; draw(); });
}
export function stopStudents() { unsub?.(); unsub = null; }
