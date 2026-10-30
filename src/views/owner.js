import { h, mount, toast, empty, skeleton, confirmDialog, field, formDialog } from "../lib/dom.js";
import { state } from "../lib/store.js";
import { ownerSchools, ownerSetSchoolStatus, adminsOf, teachersOfSchool, findTeacherByEmail, replaceAdmin, getPlatform, setPlatform, loadAudit, nationalHolidays, saveNationalHolidays } from "../lib/data.js";
import { input, select, friendlyAuthError } from "./common.js";
import { showDate } from "../lib/dates.js";
import { dateSelect } from "../lib/datepick.js";

export async function ownerSchoolsView(host, manage) {
  mount(host, h("h1", {}, "Schools"), skeleton(4)); let list; try { list = await ownerSchools(); } catch (e) { return mount(host, h("h1", {}, "Schools"), empty("Cannot load schools", friendlyAuthError(e))); }
  const draw = () => { const g = (st, t) => { const l = list.filter((x) => x.status === st).sort((a, b) => a.name.localeCompare(b.name)); return l.length ? [h("h2", {}, `${t} (${l.length})`), h("div", { class: "list" }, l.map((x) => h("div", { class: "row-card" }, h("div", {}, h("strong", {}, x.name), h("div", { class: "hint" }, `${x.type} · ${x.lga}, ${x.state} · ${x.phone}`)),
    h("div", { class: "stack-row" }, st !== "verified" ? h("button", { class: "btn btn-sm btn-primary", onclick: async () => { try { await ownerSetSchoolStatus(x, "verified"); x.status = "verified"; draw(); toast("School verified"); } catch (e) { toast(friendlyAuthError(e), "error"); } } }, "Verify") : null,
      st === "pending" ? h("button", { class: "btn btn-sm btn-danger-quiet", onclick: async () => { await ownerSetSchoolStatus(x, "rejected"); x.status = "rejected"; draw(); } }, "Reject") : null,
      st === "verified" ? h("button", { class: "btn btn-sm btn-danger-quiet", onclick: async () => { if (await confirmDialog({ title: "Unverify this school?", body: "It disappears from the teacher registration list.", confirmLabel: "Unverify", danger: true })) { await ownerSetSchoolStatus(x, "pending"); x.status = "pending"; draw(); } } }, "Unverify") : null,
      h("button", { class: "btn btn-sm", onclick: () => replaceAdminDialog(x) }, "Replace admin"), h("button", { class: "btn btn-sm", onclick: () => manage(x) }, "Open school"))))) ] : null; };
    mount(host, h("h1", {}, "Schools"), list.length ? [g("pending", "Waiting for verification"), g("verified", "Verified"), g("rejected", "Not verified")] : empty("No schools yet", "Schools appear here when an admin registers.")); };
  draw();
}

export async function auditView(host) {
  mount(host, h("h1", {}, "Audit log"), skeleton(4)); let l;
  try { l = await loadAudit(state.schoolId); } catch (e) { return mount(host, h("h1", {}, "Audit log"), empty("Cannot load the audit log", friendlyAuthError(e) + " If this is the first time, Firebase may ask you to create an index: open the link in the browser console error.")); }
  mount(host, h("h1", {}, state.schoolId ? "Audit log (this school)" : "Audit log (all schools)"), l.length ? h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["When", "Who", "Action", "Target", "Details"].map((x) => h("th", {}, x)))), h("tbody", {}, l.map((a) => h("tr", {}, h("td", {}, a.at?.toDate ? a.at.toDate().toLocaleString("en-GB") : ""), h("td", {}, a.name, a.byOwner ? h("span", { class: "tag" }, "Owner") : null), h("td", {}, a.action), h("td", {}, a.target), h("td", { class: "hint" }, a.detail)))))) : empty("Nothing yet", "Changes will be listed here."));
}

export async function ownerSettingsView(host) {
  const p = await getPlatform(); const nat = await nationalHolidays(); const out = h("p", { hidden: true, role: "status" });
  const ver = h("input", { type: "checkbox", checked: p.requireVerification !== false, onchange: async (e) => { try { await setPlatform({ requireVerification: e.target.checked }); toast("Saved"); } catch (err) { toast(friendlyAuthError(err), "error"); e.target.checked = !e.target.checked; } } });
  const date = dateSelect({ id: "nh", label: "Holiday date", from: new Date().getFullYear(), to: new Date().getFullYear() + 2, order: "asc" }), why = input({ placeholder: "Name of holiday", "aria-label": "Holiday name" }); const list = h("div", {});
  const drawN = () => mount(list, nat.length ? h("div", { class: "list" }, nat.sort((a, b) => a.date.localeCompare(b.date)).map((x, i) => h("div", { class: "row-card" }, h("div", {}, h("strong", {}, showDate(x.date)), h("div", { class: "hint" }, x.reason)), h("button", { class: "btn btn-sm btn-danger-quiet", onclick: async () => { nat.splice(nat.indexOf(x), 1); await saveNationalHolidays(nat); drawN(); } }, "Remove")))) : h("p", { class: "muted" }, "No national holidays published."));
  drawN();
  mount(host, h("h1", {}, "Settings"), h("section", { class: "card" }, h("h2", {}, "School verification"), h("label", { class: "chk" }, ver, "New schools must be verified by me before teachers can find them"), h("p", { class: "hint" }, "Switch off to let schools go live immediately.")),
    h("section", { class: "card" }, h("h2", {}, "National public holidays"), h("p", { class: "muted" }, "Each school's admin can accept these with one tap. Nothing is added to a school automatically."),
      h("div", { class: "filters" }, date, why, h("button", { class: "btn btn-primary", onclick: async () => { const d = date.value; if (!d || !why.value.trim()) return toast("Choose the full date and enter a name", "error"); nat.push({ date: d, reason: why.value.trim() }); try { await saveNationalHolidays(nat); date.value = ""; why.value = ""; drawN(); } catch (e) { toast(friendlyAuthError(e), "error"); } } }, "Publish")), list));
}

/** The owner hands a school to a new admin: choose a registered teacher (from this school, or found by email), and decide what happens to the old admin. */
async function replaceAdminDialog(school) {
  const [admins, teachers] = await Promise.all([adminsOf(school.id).catch(() => []), teachersOfSchool(school.id).catch(() => [])]);
  let chosen = null; const out = h("p", { class: "form-msg", role: "alert", hidden: true }); const picked = h("p", { class: "banner banner-info", hidden: true });
  const fail = (t) => { out.textContent = t; out.className = "form-msg error"; out.hidden = false; };
  const pick = (u) => { chosen = u; picked.textContent = `New admin: ${u.name} (${u.email})${u.schoolId !== school.id ? ". This teacher belongs to another school and will be moved to this one." : ""}`; picked.hidden = false; out.hidden = true; };
  const list = select([["", teachers.length ? "Choose a teacher of this school" : "No teachers have joined this school yet"], ...teachers.map((t) => [t.id, `${t.name} (${t.email})${t.status === "active" ? "" : ", " + t.status}`])], "", { id: "ra_t", onchange: (e) => { const u = teachers.find((t) => t.id === e.target.value); if (u) pick(u); } });
  const email = input({ id: "ra_e", type: "email", placeholder: "their@email.com" }); const old = select([["remove", "Remove their access"], ["teacher", "Keep them as a teacher (the new admin approves their roles)"]], "remove", { id: "ra_o" });
  formDialog(`Replace the admin of ${school.name}`, (close) => h("form", { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); if (!chosen) return fail("Choose the new admin first.");
    if (admins.length === 1 && admins[0].id === chosen.id) return fail("That person is already the admin.");
    if (!await confirmDialog({ title: "Replace the admin?", body: `${chosen.name} becomes the admin of ${school.name}. ${admins.length ? `${admins.map((a) => a.name).join(", ")} ${old.value === "remove" ? "loses admin access" : "becomes a teacher waiting for approval"}.` : ""} The change is recorded in the audit log.`, confirmLabel: "Replace admin", danger: true })) return;
    try { await replaceAdmin(school, chosen, admins, old.value); toast("Admin replaced"); close("ok"); } catch (err) { fail(friendlyAuthError(err)); }
  } }, h("p", { class: "muted" }, "Current admin: ", admins.length ? admins.map((a) => `${a.name} (${a.email})`).join("; ") : "none found"),
    h("p", { class: "muted" }, "The new admin must already have an account and have joined as a teacher. If they have not, ask them to register and choose \"I am a teacher joining my school\", then come back here."),
    field("Teachers of this school", list),
    h("div", { class: "field" }, h("label", { for: "ra_e" }, "Or find a teacher by email"), email, h("button", { class: "btn btn-sm", type: "button", onclick: async () => { if (!email.value.trim()) return fail("Enter an email."); const r = await findTeacherByEmail(email.value).catch(() => []); if (!r.length) return fail("No teacher account found with that email. They must register first."); pick(r[0]); } }, "Find")),
    picked, field("What happens to the current admin", old), out,
    h("div", { class: "dlg-actions sticky" }, h("button", { class: "btn", type: "button", onclick: () => close("no") }, "Cancel"), h("button", { class: "btn btn-danger", type: "submit" }, "Replace admin"))), true);
}
