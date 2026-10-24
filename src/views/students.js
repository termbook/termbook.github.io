import { h, mount, toast, confirmDialog, formDialog, field, empty, skeleton, downloadCsv, initials } from "../lib/dom.js";
import { state, roleOf, effectiveSchoolId } from "../lib/store.js";
import { watchStudents, addStudent, addStudents, updateStudent, bulkStudentAction, loadPrivate, issueAccessCode, revokeAccess, loadAccessCode, studentIdFor } from "../lib/data.js";
import { STATUS, LEFT_REASONS, classKey, promotionTarget, findDuplicates, filterStudents, parseStudentRows, parseStudentTable, readStudentFile, TEMPLATE_HEADERS, makeAdmissionNo, makeAccessCode, normName } from "../lib/students.js";
import { input, select, classPicker, allArms, classLabel, friendlyAuthError } from "./common.js";
import { showDate, parseShown, validPhone } from "../lib/dates.js";
import { autoParent } from "../lib/attendance.js";

const PAGE = 50;
let unsub = null;

export function studentsView(host) {
  const isAdmin = roleOf() === "owner" || roleOf() === "admin";
  const structure = state.school.structure; const ui = { q: "", cls: "", status: "active", deleted: false, page: 0, sel: new Set() };
  let all = null;
  const body = h("div", {}); mount(host, h("h1", {}, "Students"), body, h("div", {}, skeleton(5)));
  const teacherKeys = new Set(state.profile?.classKeys || []);
  const canAdd = isAdmin || Boolean(state.profile?.classTeacherKey);
  const addKeys = isAdmin ? null : state.profile?.classTeacherKey;

  function draw() {
    const rows = filterStudents(all, { q: ui.q, cls: ui.cls, status: ui.status, showDeleted: ui.deleted }).sort((a, b) => a.name.localeCompare(b.name));
    const pages = Math.max(1, Math.ceil(rows.length / PAGE)); ui.page = Math.min(ui.page, pages - 1);
    const view = rows.slice(ui.page * PAGE, ui.page * PAGE + PAGE);
    const counts = { active: 0, pending: 0, left: 0, graduated: 0 }; all.filter((s) => !s.deleted).forEach((s) => counts[s.status] = (counts[s.status] || 0) + 1);
    const selected = [...ui.sel].filter((id) => all.some((s) => s.id === id));
    const search = h("input", { type: "search", placeholder: "Search by name or admission number", "aria-label": "Search students", value: ui.q, oninput: (e) => { ui.q = e.target.value; ui.page = 0; clearTimeout(draw.t); draw.t = setTimeout(draw, 200); } });
    const classOpts = [["", "All classes"], ...structure.classes.map((c) => [c.name, c.name])];
    const statusOpts = [["active", `Active (${counts.active})`], ["pending", `Pending (${counts.pending})`], ["left", `No longer in school (${counts.left})`], ["graduated", `Graduated (${counts.graduated})`], ["all", "All statuses"]];
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
      h("thead", {}, h("tr", {}, isAdmin ? h("th", { scope: "col" }, h("input", { type: "checkbox", "aria-label": "Select all on this page", checked: view.length > 0 && view.every((s) => ui.sel.has(s.id)), onchange: (e) => { view.forEach((s) => e.target.checked ? ui.sel.add(s.id) : ui.sel.delete(s.id)); draw(); } })) : null, h("th", { scope: "col" }, "Name"), h("th", { scope: "col" }, "Class"), h("th", { scope: "col" }, "Admission no."), h("th", { scope: "col" }, "Status"), h("th", { scope: "col" }, ""))),
      h("tbody", {}, view.map((s) => h("tr", { class: s.deleted ? "deleted" : "" },
        isAdmin ? h("td", {}, h("input", { type: "checkbox", "aria-label": `Select ${s.name}`, checked: ui.sel.has(s.id), onchange: (e) => { e.target.checked ? ui.sel.add(s.id) : ui.sel.delete(s.id); draw(); } })) : null,
        h("td", {}, h("span", { class: "avatar", "aria-hidden": "true" }, initials(s.name)), s.name, s.repeater ? h("span", { class: "tag tag-warn" }, "Repeater") : null),
        h("td", {}, classLabel(s.classKey || "")), h("td", {}, s.admissionNo),
        h("td", {}, h("span", { class: `tag tag-${s.deleted ? "err" : s.status}` }, s.deleted ? "Removed" : STATUS[s.status] || s.status), s.status === "left" && s.leftReason ? h("div", { class: "hint" }, s.leftReason + (s.leftOn ? ` (${showDate(s.leftOn)})` : "")) : null),
        h("td", {}, h("button", { class: "btn btn-sm", type: "button", onclick: () => editDialog(s) }, "Open")))))))
      : empty("No students match", ui.status === "active" && !all.length ? "Add students one by one or paste a list to get started." : "Try a different search or filter.");
    const pager = pages > 1 ? h("div", { class: "pager" }, h("button", { class: "btn btn-sm", disabled: ui.page === 0, onclick: () => { ui.page--; draw(); } }, "Previous"), h("span", {}, `Page ${ui.page + 1} of ${pages} (${rows.length} students)`), h("button", { class: "btn btn-sm", disabled: ui.page >= pages - 1, onclick: () => { ui.page++; draw(); } }, "Next")) : h("p", { class: "muted" }, `${rows.length} student${rows.length === 1 ? "" : "s"}`);
    mount(body,
      h("div", { class: "toolbar" }, canAdd ? h("button", { class: "btn btn-primary", type: "button", onclick: () => editDialog(null) }, "Add student") : null,
        canAdd ? h("button", { class: "btn", type: "button", onclick: bulkAddDialog }, "Paste or import list") : null,
        canAdd ? h("button", { class: "btn", type: "button", onclick: () => downloadCsv("students-template.csv", [TEMPLATE_HEADERS]) }, "Download template") : null,
        h("button", { class: "btn", type: "button", onclick: () => exportCsv(rows) }, "Export CSV")),
      h("div", { class: "filters" }, search, select(classOpts, ui.cls, { "aria-label": "Class", onchange: (e) => { ui.cls = e.target.value; ui.page = 0; draw(); } }),
        select(statusOpts, ui.status, { "aria-label": "Status", onchange: (e) => { ui.status = e.target.value; ui.page = 0; draw(); } }),
        isAdmin ? h("label", { class: "chk" }, h("input", { type: "checkbox", checked: ui.deleted, onchange: (e) => { ui.deleted = e.target.checked; ui.sel.clear(); draw(); } }), "Show removed") : null),
      bar, table, pager);
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
    const isNew = !s; const keyDefault = ui.cls ? classKey(ui.cls, structure.classes.find((c) => c.name === ui.cls)?.arms[0]) : "";
    const name = input({ id: "n", value: s?.name || "" }); const gender = select([["M", "Male"], ["F", "Female"]], s?.gender || "M");
    const adm = input({ id: "a", value: s?.admissionNo || "", disabled: !isNew, placeholder: isNew ? "Leave blank to generate one" : "" });
    const cp = addKeys ? h("input", { value: classLabel(addKeys), disabled: true, id: "cp" }) : classPicker(structure, s?.classKey || keyDefault);
    const rep = h("input", { type: "checkbox", checked: Boolean(s?.repeater) }); const dob = input({ id: "d", placeholder: "DD/MM/YYYY", value: showDate(s?.dob) });
    const par = input({ id: "p", value: s?.parentName || "" }); const addr = input({ id: "ad" }); const ph = input({ id: "ph", type: "tel" });
    const relOn = h("input", { type: "checkbox" }); const rel = select(["", "Christianity", "Islam", "Traditional", "Other", "Prefer not to say"], ""); rel.hidden = true; relOn.addEventListener("change", () => (rel.hidden = !relOn.checked));
    const statusSel = isAdmin && !isNew ? select(Object.entries(STATUS), s.status) : null;
    const out = h("p", { class: "form-msg", role: "alert", hidden: true }); const codeBox = h("div", {});
    const canPrivate = isAdmin || Boolean(addKeys); 
    if (s && canPrivate) loadPrivate(s.id).then((p) => { addr.value = p.address || ""; ph.value = p.phone || ""; if (p.religion) { relOn.checked = true; rel.hidden = false; rel.value = p.religion; } });
    if (s && isAdmin) renderCode();
    async function renderCode() {
      const c = await loadAccessCode(s.id).catch(() => null);
      mount(codeBox, h("h3", {}, "Parent access code"), c?.active ? h("p", {}, "Code: ", h("strong", { class: "code" }, c.code), " Share it with the parent, together with the admission number.") : h("p", { class: "muted" }, "No active code."),
        h("div", { class: "stack-row" }, h("button", { class: "btn btn-sm", type: "button", onclick: async () => { await issueAccessCode(s, makeAccessCode()); renderCode(); } }, c?.active ? "Replace code" : "Create code"),
          c?.active ? h("button", { class: "btn btn-sm btn-danger-quiet", type: "button", onclick: async () => { if (await confirmDialog({ title: "Revoke parent access?", body: "The code stops working and any linked parent loses access.", confirmLabel: "Revoke", danger: true })) { await revokeAccess(s); renderCode(); } } }, "Revoke access") : null));
    }
    const save = h("button", { class: "btn btn-primary", type: "submit" }, isNew ? "Add student" : "Save changes");
    formDialog(isNew ? "Add student" : s.name, (close) => h("form", { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); out.hidden = true; const nm = normName(name.value); const key = addKeys || cp.value;
      const fail = (t) => { out.textContent = t; out.className = "form-msg error"; out.hidden = false; };
      if (!nm) return fail("Enter the student's name (surname first)."); if (!key) return fail("Choose a class and arm.");
      if (dob.value && !parseShown(dob.value)) return fail("Date of birth must be DD/MM/YYYY."); if (ph.value && !validPhone(ph.value)) return fail("Enter a valid parent phone number.");
      const [c, a] = key.split("|"); const taken = new Set(all.map((x) => x.admissionNo)); const admNo = adm.value.trim() || s?.admissionNo || makeAdmissionNo(taken);
      const rec = { name: nm, gender: gender.value, class: c, arm: a, repeater: rep.checked, dob: parseShown(dob.value), parentName: par.value.trim() };
      const priv = { address: addr.value.trim(), phone: ph.value.replace(/[\s-]/g, ""), religion: relOn.checked ? rel.value : "" };
      try {
        if (isNew) {
          const dups = findDuplicates(all, { ...rec, admissionNo: admNo, classKey: key });
          if (dups.length && !await confirmDialog({ title: "Possible duplicate", body: `${dups[0].name} (${classLabel(dups[0].classKey)}, ${dups[0].admissionNo}) looks like this student. Add anyway?`, confirmLabel: "Add anyway" })) return;
          await addStudent({ ...rec, admissionNo: admNo, status: isAdmin ? "active" : "pending" }, priv); toast(isAdmin ? "Student added" : "Student added. The admin will confirm.");
        } else { if (statusSel) rec.status = statusSel.value; await updateStudent(s.id, rec, priv); toast("Saved"); }
        close("ok");
      } catch (err) { fail(friendlyAuthError(err)); }
    } }, field("Full name (surname first)", name), field("Gender", gender), field("Admission number", adm, isNew ? "Cannot be changed later." : null), field(addKeys ? "Class (yours)" : "Class and arm", cp),
      h("label", { class: "chk" }, rep, "Repeater"), statusSel ? field("Status", statusSel) : null, field("Date of birth (optional)", dob),
      h("div", { class: "field" }, h("label", { for: "p" }, "Parent or guardian"), par, h("button", { class: "btn btn-sm", type: "button", onclick: () => (par.value = autoParent(name.value)) }, "Auto-fill")),
      canPrivate ? [h("p", { class: "hint" }, "The next fields are visible only to the school admin and this class's teacher."), field("Address (optional)", addr), field("Parent phone (optional)", ph),
        h("label", { class: "chk" }, relOn, "Record religion (optional, sensitive)"), rel] : null,
      out, h("div", { class: "dlg-actions" }, h("button", { class: "btn", type: "button", onclick: () => close("no") }, "Cancel"), save), isAdmin && s ? codeBox : null));
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
      const r = fileRows; const noGender = r.filter((x) => !x.gender).length, badDob = r.filter((x) => x.dobBad).length, badPh = r.filter((x) => x.phoneBad).length;
      const problems = [noGender && `${noGender} without a gender (they will be set to Male: fix them afterwards)`, badDob && `${badDob} with a date of birth that is not DD/MM/YYYY (left blank)`, badPh && `${badPh} with a phone number that is not valid (left blank)`].filter(Boolean);
      mount(info, h("p", {}, h("strong", {}, `${name}: ${r.length} student${r.length === 1 ? "" : "s"} found`)), problems.length ? h("ul", {}, problems.map((x) => h("li", {}, x))) : h("p", { class: "muted" }, "Everything in the file was read correctly."),
        h("button", { class: "btn btn-sm", type: "button", onclick: () => { fileRows = null; file.value = ""; info.hidden = true; } }, "Remove file")); info.hidden = false;
    }
    const validKey = (c, a) => structure.classes.some((x) => x.name === c && x.arms.includes(a)) ? classKey(c, a) : "";
    formDialog("Add many students", (close) => h("form", { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); out.hidden = true; const rows = rowsNow(); if (!rows.length) return fail("Choose a file or type at least one name.");
      const dlg = addKeys || cp.value; const taken = new Set(all.map((x) => x.admissionNo)); const list = [], skipped = [], wrongClass = [];
      for (const r of rows) {
        const key = (r.class && r.arm ? validKey(r.class, r.arm) : "") || dlg;
        if (!key) { wrongClass.push(r.name); continue; } if (addKeys && key !== addKeys) { wrongClass.push(r.name); continue; }
        if (r.admissionNo && taken.has(r.admissionNo)) { skipped.push(r.name); continue; }
        const adm = r.admissionNo || makeAdmissionNo(taken); taken.add(adm); const [c, a] = key.split("|");
        list.push({ name: r.name, gender: r.gender || "M", repeater: Boolean(r.repeater), admissionNo: adm, class: c, arm: a, status: isAdmin ? "active" : "pending", parentName: r.parentName || "", dob: r.dob || "", _priv: { address: r.address || "", phone: r.phone || "", religion: "" } });
      }
      if (!list.length) return fail(wrongClass.length ? "No students could be placed. Choose a class and arm, or check the Class and Arm columns." : "Nothing to add.");
      const notes = [skipped.length && `${skipped.length} skipped because the admission number already exists.`, wrongClass.length && `${wrongClass.length} skipped because their class or arm ${addKeys ? "is not your class" : "is missing or not in your school's list"}.`, !isAdmin && "They will wait for the admin to confirm."].filter(Boolean).join(" ");
      if (!await confirmDialog({ title: `Add ${list.length} student(s)?`, body: notes || "Check the list, then confirm.", confirmLabel: "Add" })) return;
      try { await addStudents(list); toast(`${list.length} students added`); close("ok"); } catch (err) { fail(friendlyAuthError(err)); }
    } }, h("p", { class: "muted" }, "Choose the filled students file (CSV or Excel). It is read exactly as saved: name, gender, class, arm, admission number, repeater, date of birth and, if present, parent name, address and parent phone."),
      h("p", {}, h("button", { class: "btn btn-sm", type: "button", onclick: () => downloadCsv("students-template.csv", [TEMPLATE_HEADERS]) }, "Download the blank template")),
      field("Student file", file), info, field("Class and arm", cp, "Used for any student whose row has no valid Class and Arm."), ta, out,
      h("div", { class: "dlg-actions" }, h("button", { class: "btn", type: "button", onclick: () => close("no") }, "Cancel"), h("button", { class: "btn btn-primary", type: "submit" }, "Review and add"))));
  }

  unsub?.(); unsub = watchStudents((list, err) => { if (err) return mount(body, empty("Cannot load students", friendlyAuthError(err))); state.students = list; all = list; draw(); });
}
export function stopStudents() { unsub?.(); unsub = null; }
