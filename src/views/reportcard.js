import { h, toast, formDialog, field, confirmDialog } from "../lib/dom.js";
import { RATING_NAME, AFFECTIVE, PSYCHOMOTOR } from "../lib/reportcard.js";
import { saveRemarks, saveRemarksBulk } from "../lib/data.js";
import { CONDUCT_TEMPLATES, bandsFor, commentFor } from "../lib/templates.js";
import { friendlyAuthError } from "./common.js";
import { state, roleOf } from "../lib/store.js";

const td = (content, o = {}) => h("td", { class: o.cls || null, colspan: o.span || null, rowspan: o.rows || null }, content);
const th = (content, o = {}) => h("th", { class: o.cls || null, colspan: o.span || null, rowspan: o.rows || null }, content);
const nz = (v) => (v === 0 || v === "" || v === undefined ? "0" : String(v));

/** The student report card, laid out like the Oyo State school report card. Everything printed comes from the card object. */
export function renderReportCard(card, { logo = "", stateLogo = "" } = {}) {
  const st = card.student, c = card.counts, a = card.attendance, final = card.final;
  const img = (src, alt, cls) => (src ? h("img", { src, alt, class: cls || null }) : null);
  const head = h("table", { class: "rc-t rc-head" },
    h("tr", {}, td(img(stateLogo, "State crest", "rc-logo"), { rows: 3, cls: "rc-logocell" }), td(card.header.heading, { cls: "rc-title" }), td(img(logo, "School logo", "rc-logo"), { rows: 3, cls: "rc-logocell" })),
    h("tr", {}, td(card.header.subheading, { cls: "rc-sub" })),
    h("tr", {}, td(h("table", { class: "rc-t rc-inner" }, h("tr", {}, td("STUDENT REPORT CARD", { cls: "rc-gold rc-ul rc-b" }), td("Age:", { cls: "rc-lab" }), td(st.age === "" ? "" : String(st.age), { cls: "rc-val" }), td("Class Category:", { cls: "rc-lab" }), td(st.classCategory, { cls: "rc-val" }))), { cls: "rc-strip" })));
  const lab = (t, span) => td(t, { cls: "rc-lab", span }); const val = (t, span) => td(t, { cls: "rc-val", span });
  const info = h("table", { class: "rc-t rc-g24" },
    h("tr", {}, val(String(st.sn), 2), lab("Student Name:", 4), td(st.name, { cls: "rc-val rc-big", span: 6 }), lab("Gender", 2), val(st.gender, 2), lab("Adm. No.", 2), val(st.admissionNo, 2), lab("Class:", 2), val(st.className, 2)),
    h("tr", {}, lab("Number of Subjects Offered:", 4), val(String(c.offered), 2), lab("Number Passed:", 3), val(String(c.passed), 2), lab("Number Failed:", 3), val(String(c.failed), 2), lab("Number of Students in Class:", 3), val(String(c.classSize), 2), lab("Class Position", 2), val(c.position ? ordinalOf(c.position) : "", 1)),
    h("tr", {}, lab("No of Times School Opened:", 4), val(String(a.opened), 2), lab("No of Times Present:", 3), val(String(a.present), 2), lab("No of Times Absent:", 3), val(String(a.absent), 2), lab("Academic Session:", 3), val(card.session, 2), lab("Term:", 2), val(card.termName, 1)));
  const bar = (t) => h("div", { class: "rc-bar" }, t);
  const T = card.termName.charAt(0) + card.termName.slice(1).toLowerCase();
  const tn = { 1: "1st", 2: "2nd", 3: "3rd" }[card.term];
  const rowsEl = card.rows.map((r) => h("tr", { class: r.offered ? "" : "na" },
    td(String(r.sn), { cls: "rc-c" }), td(r.subject), td(r.offered ? "100" : "--", { cls: "rc-c" }),
    final ? [td(nz(r.ca), { cls: "rc-c" }), td(nz(r.exam), { cls: "rc-c" }), td(nz(r.total), { cls: "rc-c" }), td(nz(r.t2), { cls: "rc-c" }), td(nz(r.t1), { cls: "rc-c" }), td(nz(r.avg), { cls: "rc-c rc-b" })] : [td(nz(r.ca), { cls: "rc-c" }), td(nz(r.exam), { cls: "rc-c" }), td(nz(r.total), { cls: "rc-c" })],
    td(r.grade, { cls: "rc-c" }), td(r.remark, { cls: "rc-c rc-sm" })));
  const sub = (pct) => h("div", { class: "rc-pct" }, `${pct}%`);
  const headRow = final
    ? h("tr", { class: "rc-th" }, th("S/NO"), th("Subject"), th("Marks Obtain-able"), th(["3rd Term C.A.", sub(card.pct.ca)]), th(["3rd Term Exam", sub(card.pct.exam)]), th(["3rd Term Total", sub(100)]), th("2nd Term Total (100%)"), th("1st Term Total (100%)"), th("Average Score in %"), th("Grade Obtained"), th("Remarks"))
    : h("tr", { class: "rc-th" }, th("S/NO"), th("Subject"), th("Marks Obtain-able"), th([`${tn} Term Continuous Assessment (C.A.)`, sub(card.pct.ca)]), th([`${tn} Term Examination`, sub(card.pct.exam)]), th([`${tn} Term Total Score`, sub(100)]), th("Grade Obtained"), th("Remarks"));
  const tot = card.totals;
  const totalRow = final
    ? h("tr", { class: "rc-tot" }, td("TOTAL MARKS OBTAINABLE:", { cls: "rc-lab", span: 2 }), td(String(tot.obtainable), { cls: "rc-c rc-b" }), td("", { span: 4 }), td("TOTAL MARKS OBTAINED:", { cls: "rc-lab rc-sm" }), td(String(tot.obtained), { cls: "rc-c rc-b" }), td("%", { cls: "rc-c rc-b" }), td(String(tot.percent), { cls: "rc-c rc-b" }))
    : h("tr", { class: "rc-tot" }, td("TOTAL MARKS OBTAINABLE:", { cls: "rc-lab", span: 2 }), td(String(tot.obtainable), { cls: "rc-c rc-b" }), td(""), td("TOTAL MARKS OBTAINED:", { cls: "rc-lab rc-sm" }), td(String(tot.obtained), { cls: "rc-c rc-b" }), td("%", { cls: "rc-c rc-b" }), td(String(tot.percent), { cls: "rc-c rc-b" }));
  const cog = h("table", { class: `rc-t rc-cog${final ? " rc-final" : ""}` }, h("thead", {}, headRow), h("tbody", {}, rowsEl), h("tfoot", {}, totalRow));
  const key = h("div", { class: "rc-key" }, h("b", {}, "GRADE INTERPRETATION ::: "), card.gradeKey.map((g) => h("span", { class: "rc-green" }, `${g.g}: ${String(g.label).toUpperCase()}`)));
  const domain = (title, d, n) => [bar(title), h("table", { class: `rc-t rc-dom n${n}` },
    h("tr", {}, d.items.map((i) => th(i.label.toUpperCase(), { cls: "rc-trait" })), td("TOTAL SCORE", { cls: "rc-b rc-c" }), td(String(d.total || ""), { cls: "rc-b rc-c rc-big" })),
    h("tr", {}, d.items.map((i) => td(i.text || "--", { cls: "rc-c rc-faint" })), td("SCORE OBTAINED", { cls: "rc-b rc-c", rows: 2 }), td(String(d.obtained || ""), { cls: "rc-b rc-c rc-big", rows: 2 })),
    h("tr", {}, d.items.map((i) => td(i.rating ? String(i.rating) : "--", { cls: "rc-c rc-faint" }))))];
  const ratingKey = h("div", { class: "rc-key" }, h("b", {}, "NON-COGNITIVE ASPECTS RATING KEYS: "), [5, 4, 3, 2, 1].map((n) => h("span", { class: "rc-green" }, `${n}-${RATING_NAME[n]}`)));
  const cm = card.comments;
  const comments = h("table", { class: "rc-t rc-cm" },
    h("tr", {}, td("Class Tutor's Comment:", { cls: "rc-lab" }), td(cm.tutor, { cls: "rc-b rc-sm" }), td("Class Tutor's Name:", { cls: "rc-lab" }), td(cm.tutorName, { cls: "rc-val" })),
    h("tr", {}, td("Principal's Comment:", { cls: "rc-lab" }), td(cm.principal, { cls: "rc-b rc-c" }), td("Parent Signature:", { cls: "rc-lab" }), td("")),
    h("tr", {}, td("Principal's Signature/Stamp:", { cls: "rc-lab" }), td(img(cm.signature, "Principal's signature", "rc-sign"), { span: 3 })));
  const foot = h("table", { class: "rc-t rc-foot" }, h("tr", {}, td(card.footer.nextTerm, { cls: "rc-next" }), td(img(stateLogo, "", "rc-mini"), { cls: "rc-c" }), td(card.header.footerCredit, { cls: "rc-credit" })));
  return h("article", { class: `rc${card.rows.length > 22 ? " dense" : ""}`, "aria-label": `Report card for ${st.name}` }, head, info, bar("COGNITIVE (ACADEMIC PERFORMANCE)"), cog, key, domain("BEHAVIOURAL (AFFECTIVE DOMAIN)", card.affective, 8), domain("PSYCHOMOTOR DOMAIN", card.psychomotor, 7), ratingKey, comments, foot);
}
const ordinalOf = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || "th");

const ALL_TRAITS = [...AFFECTIVE, ...PSYCHOMOTOR];
const short = (t) => (t.length > 70 ? `${t.slice(0, 67)}...` : t);
const commentOptions = (bands, matchLabel) => [["", "Choose a template..."], ["match", matchLabel], ...bands.map((b, i) => [String(i), `${b.min}% and above: ${short(b.text)}`])];

/** One student: ratings and comments, with templates to fill them quickly. */
export function remarksDialog({ student, card, existing = {}, session, term, school, onSaved }) {
  const isAdmin = roleOf() === "owner" || roleOf() === "admin"; const rep = school.report || {};
  const tutorBands = bandsFor(school, "tutor"), principalBands = bandsFor(school, "principal"); const pct = card?.totals?.percent ?? 0;
  const ratings = { ...(existing.ratings || {}) };
  const opts = [["", "Not rated"], ...[5, 4, 3, 2, 1].map((n) => [String(n), `${RATING_NAME[n]} (${n})`])];
  const sels = {}; const sel = (k) => (sels[k] = h("select", { id: `r_${k}`, "aria-label": k, onchange: (e) => (e.target.value ? (ratings[k] = +e.target.value) : delete ratings[k]) }, opts.map(([v, l]) => h("option", { value: v, selected: String(ratings[k] || "") === v }, l))));
  const group = (title, items) => h("fieldset", { class: "sect" }, h("legend", {}, title), h("div", { class: "form-grid" }, items.map(([k, label]) => field(label, sel(k)))));
  const tutor = h("textarea", { id: "tc", rows: 2 }, existing.tutorComment ?? rep.tutorComment ?? ""); const principal = h("textarea", { id: "pc", rows: 2, disabled: !isAdmin }, existing.principalComment ?? rep.principalComment ?? "");
  const name = h("input", { id: "tn", type: "text", value: existing.tutorName ?? (isAdmin ? "" : state.profile?.name ?? "") }); const out = h("p", { class: "form-msg", role: "alert", hidden: true });
  const conductTpl = h("select", { id: "ct", onchange: (e) => { const t = CONDUCT_TEMPLATES.find((x) => x.id === e.target.value); if (t) for (const [k] of ALL_TRAITS) { ratings[k] = t.ratings[k]; sels[k].value = String(t.ratings[k]); } e.target.value = ""; } }, [["", "Choose a template..."], ...CONDUCT_TEMPLATES.map((t) => [t.id, t.label])].map(([v, l]) => h("option", { value: v }, l)));
  const commentTpl = (bands, area) => h("select", { "aria-label": "Comment template", onchange: (e) => { const v = e.target.value; if (v === "match") area.value = commentFor(bands, pct); else if (v !== "") area.value = bands[+v].text; e.target.value = ""; } }, commentOptions(bands, `Match this student's result (${pct}%)`).map(([v, l]) => h("option", { value: v }, l)));
  formDialog(`Conduct and comments: ${student.name}`, (close) => h("form", { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); try { const patch = { ratings, tutorComment: tutor.value.trim(), tutorName: name.value.trim() }; if (isAdmin) patch.principalComment = principal.value.trim(); await saveRemarks(session, term, student, patch); toast("Saved"); close("ok"); onSaved?.(); } catch (err) { out.textContent = friendlyAuthError(err); out.className = "form-msg error"; out.hidden = false; }
  } }, h("p", { class: "muted" }, "Rate each trait from Excellent (5) to Fair (1), or fill them all from a template and then change any. A trait left as Not rated is left out of the total."),
    field("Fill all traits from a template", conductTpl),
    group("Behavioural (affective domain)", AFFECTIVE), group("Psychomotor domain", PSYCHOMOTOR),
    field("Class tutor's comment", tutor), field("Comment template", commentTpl(tutorBands, tutor)), field("Class tutor's name", name),
    field("Principal's comment", principal, isAdmin ? null : "The principal's comment is added by the school admin."), isAdmin ? field("Principal's comment template", commentTpl(principalBands, principal)) : null, out,
    h("div", { class: "dlg-actions sticky" }, h("button", { class: "btn", type: "button", onclick: () => close("no") }, "Cancel"), h("button", { class: "btn btn-primary", type: "submit" }, "Save"))), true);
}

/**
 * Apply templates to many students at once: the whole class, the ticked students, or (admin) every class.
 * targets: [{ student, card, existing }]. loadSchoolWide() returns the same list for every class in the school.
 */
export function applyTemplatesDialog({ targets, selectedCount, session, term, school, loadSchoolWide, onDone }) {
  const isAdmin = roleOf() === "owner" || roleOf() === "admin";
  const tutorBands = bandsFor(school, "tutor"), principalBands = bandsFor(school, "principal");
  const who = h("select", { id: "aw" }, [["all", `Everyone in this class (${targets.length})`], ["selected", `Only the ticked students (${selectedCount})`], ...(isAdmin && loadSchoolWide ? [["school", "Every class in the school"]] : [])].map(([v, l]) => h("option", { value: v, disabled: v === "selected" && !selectedCount }, l)));
  const conduct = h("select", { id: "ac" }, [["", "Do not change conduct"], ...CONDUCT_TEMPLATES.map((t) => [t.id, t.label])].map(([v, l]) => h("option", { value: v }, l)));
  const replaceRatings = h("input", { type: "checkbox" }); const replaceTutor = h("input", { type: "checkbox" }); const replacePrincipal = h("input", { type: "checkbox" });
  const pick = (id, bands) => h("select", { id }, [["", "Do not change"], ["match", "Match each student's result (by total percentage)"], ...bands.map((b, i) => [String(i), `Same for everyone: ${short(b.text)}`])].map(([v, l]) => h("option", { value: v }, l)));
  const tutor = pick("at", tutorBands), principal = pick("ap", principalBands); const out = h("p", { class: "form-msg", role: "alert", hidden: true });
  const textFor = (v, bands, percent) => (v === "match" ? commentFor(bands, percent) : bands[+v]?.text || "");
  formDialog("Apply templates", (close) => h("form", { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); const fail = (t) => { out.textContent = t; out.className = "form-msg error"; out.hidden = false; };
    if (!conduct.value && !tutor.value && !(isAdmin && principal.value)) return fail("Choose at least one template to apply.");
    try {
      let list = targets; if (who.value === "selected") list = targets.filter((t) => t.selected); if (who.value === "school") list = await loadSchoolWide();
      if (!list.length) return fail("No students to apply to.");
      if (!await confirmDialog({ title: `Apply to ${list.length} student${list.length === 1 ? "" : "s"}?`, body: "Anything already entered is kept unless you ticked replace.", confirmLabel: "Apply" })) return;
      const tpl = CONDUCT_TEMPLATES.find((t) => t.id === conduct.value); const items = [];
      for (const { student, card, existing = {} } of list) {
        const pct = card?.totals?.percent ?? 0; const patch = {};
        if (tpl) { const have = existing.ratings || {}; patch.ratings = replaceRatings.checked ? { ...tpl.ratings } : { ...tpl.ratings, ...have }; }
        if (tutor.value && (replaceTutor.checked || !existing.tutorComment)) patch.tutorComment = textFor(tutor.value, tutorBands, pct);
        if (isAdmin && principal.value && (replacePrincipal.checked || !existing.principalComment)) patch.principalComment = textFor(principal.value, principalBands, pct);
        if (!existing.tutorName && !isAdmin && state.profile?.name) patch.tutorName = state.profile.name;
        if (Object.keys(patch).length) items.push({ student, patch });
      }
      await saveRemarksBulk(session, term, items); toast(`Applied to ${items.length} student${items.length === 1 ? "" : "s"}`); close("ok"); onDone?.();
    } catch (err) { fail(friendlyAuthError(err)); }
  } }, h("p", { class: "muted" }, "Fill many students at once from templates. You can still change any student afterwards."),
    field("Apply to", who),
    h("fieldset", { class: "sect" }, h("legend", {}, "Conduct (behavioural and psychomotor)"), field("Template", conduct), h("label", { class: "chk" }, replaceRatings, "Replace ratings already entered (otherwise only empty traits are filled)")),
    h("fieldset", { class: "sect" }, h("legend", {}, "Class tutor's comment"), field("Template", tutor), h("label", { class: "chk" }, replaceTutor, "Replace comments already entered")),
    isAdmin ? h("fieldset", { class: "sect" }, h("legend", {}, "Principal's comment"), field("Template", principal), h("label", { class: "chk" }, replacePrincipal, "Replace comments already entered")) : null, out,
    h("div", { class: "dlg-actions sticky" }, h("button", { class: "btn", type: "button", onclick: () => close("no") }, "Cancel"), h("button", { class: "btn btn-primary", type: "submit" }, "Apply"))), true);
}
