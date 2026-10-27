import { h, mount, toast, empty, skeleton, confirmDialog, field } from "../lib/dom.js";
import { state } from "../lib/store.js";
import { ownerSchools, ownerSetSchoolStatus, getPlatform, setPlatform, loadAudit, nationalHolidays, saveNationalHolidays } from "../lib/data.js";
import { input, friendlyAuthError } from "./common.js";
import { showDate } from "../lib/dates.js";
import { dateSelect } from "../lib/datepick.js";

export async function ownerSchoolsView(host, manage) {
  mount(host, h("h1", {}, "Schools"), skeleton(4)); let list; try { list = await ownerSchools(); } catch (e) { return mount(host, h("h1", {}, "Schools"), empty("Cannot load schools", friendlyAuthError(e))); }
  const draw = () => { const g = (st, t) => { const l = list.filter((x) => x.status === st).sort((a, b) => a.name.localeCompare(b.name)); return l.length ? [h("h2", {}, `${t} (${l.length})`), h("div", { class: "list" }, l.map((x) => h("div", { class: "row-card" }, h("div", {}, h("strong", {}, x.name), h("div", { class: "hint" }, `${x.type} · ${x.lga}, ${x.state} · ${x.phone}`)),
    h("div", { class: "stack-row" }, st !== "verified" ? h("button", { class: "btn btn-sm btn-primary", onclick: async () => { try { await ownerSetSchoolStatus(x, "verified"); x.status = "verified"; draw(); toast("School verified"); } catch (e) { toast(friendlyAuthError(e), "error"); } } }, "Verify") : null,
      st === "pending" ? h("button", { class: "btn btn-sm btn-danger-quiet", onclick: async () => { await ownerSetSchoolStatus(x, "rejected"); x.status = "rejected"; draw(); } }, "Reject") : null,
      st === "verified" ? h("button", { class: "btn btn-sm btn-danger-quiet", onclick: async () => { if (await confirmDialog({ title: "Unverify this school?", body: "It disappears from the teacher registration list.", confirmLabel: "Unverify", danger: true })) { await ownerSetSchoolStatus(x, "pending"); x.status = "pending"; draw(); } } }, "Unverify") : null,
      h("button", { class: "btn btn-sm", onclick: () => manage(x) }, "Open school"))))) ] : null; };
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
