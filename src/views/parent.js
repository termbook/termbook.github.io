import { h, mount, toast, empty, field, skeleton } from "../lib/dom.js";
import { state } from "../lib/store.js";
import { publicSchools, linkChild, myChild, reportsForStudent, termId, currentSessionLabel, publicSchoolBranding } from "../lib/data.js";
import { input, select, msg, friendlyAuthError, loadNg } from "./common.js";
import { renderReportCard } from "./reportcard.js";
import { printNodes } from "./scores.js";

export async function parentView(host) {
  const links = state.profile.links || []; const body = h("div", {});
  mount(host, h("h1", {}, "My child"), body, skeleton(3));
  const [y] = currentSessionLabel().split("/").map(Number); const sessions = [`${y}/${y + 1}`, `${y - 1}/${y}`];
  const cards = [];
  for (const l of links) {
    let child = null; try { child = await myChild(l.schoolId, l); } catch { /* link revoked */ }
    if (!child) { cards.push(h("div", { class: "card" }, h("p", {}, `Access to admission number ${l.admissionNo} is no longer available. Ask the school for a new code.`))); continue; }
    const tids = sessions.flatMap((s) => [3, 2, 1].map((t) => termId(s, t))); const reports = await reportsForStudent(l.schoolId, l.studentId, tids);
    const logos = reports.length ? await publicSchoolBranding(l.schoolId) : {};
    cards.push(h("section", { class: "card" }, h("h2", {}, child.name), h("p", { class: "muted" }, `${child.class}${child.arm} · Admission no. ${child.admissionNo}`),
      reports.length ? reports.map((r) => h("div", { class: "rc-scroll" }, renderReportCard(r.card, logos), h("button", { class: "btn btn-sm btn-primary", onclick: () => printNodes([renderReportCard(r.card, logos)]) }, "Print / save as PDF"))) : h("p", { class: "muted" }, "Results will appear here after the school publishes the term.")));
  }
  const ng = await loadNg(); const schools = await publicSchools().catch(() => []);
  const st = select([["", "Choose state"], ...ng.map((x) => [x.name, x.name])], ""); const lga = select([["", "Choose local government"]], ""); const sch = select([["", "Choose school"]], "");
  st.addEventListener("change", () => { lga.replaceChildren(...[["", "Choose local government"], ...(ng.find((x) => x.name === st.value)?.lgas.map((x) => [x, x]) || [])].map(([v, t]) => h("option", { value: v }, t))); });
  lga.addEventListener("change", () => { const l = schools.filter((x) => x.state === st.value && x.lga === lga.value).sort((a, b) => a.name.localeCompare(b.name)); sch.replaceChildren(h("option", { value: "" }, "Choose school"), ...l.map((x) => h("option", { value: x.id }, x.name))); });
  const adm = input({ id: "ad" }); const code = input({ id: "cd", autocapitalize: "characters", autocomplete: "off" }); const out = h("p", { role: "alert", hidden: true });
  const form = h("form", { class: "card", novalidate: true, onsubmit: async (e) => { e.preventDefault(); if (!sch.value || !adm.value.trim() || !code.value.trim()) return msg(out, "Choose the school and enter the admission number and code."); try { await linkChild({ schoolId: sch.value, admissionNo: adm.value.trim(), code: code.value.trim().toUpperCase() }); state.profile.links = [...links]; toast("Linked"); location.reload(); } catch (err) { msg(out, err?.code === "permission-denied" ? "That admission number and code do not match, or the access was revoked. Check them with the school." : friendlyAuthError(err)); } } },
    h("h2", {}, "Link a child"), h("p", { class: "muted" }, "Your school gives you an admission number and an access code."), field("State", st), field("Local government", lga), field("School", sch), field("Admission number", adm), field("Access code", code), out, h("button", { class: "btn btn-primary", type: "submit" }, "Link child"));
  mount(body, cards.length ? cards : empty("No child linked yet", "Use the form below with the code from your child's school."), form);
}
