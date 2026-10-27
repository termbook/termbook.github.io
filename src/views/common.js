import { h, field } from "../lib/dom.js";
import { classKey, splitKey } from "../lib/students.js";
import { allSubjects, classesForSubject, armsOf } from "../lib/structure.js";

let ngCache;
export async function loadNg() { if (!ngCache) ngCache = (await (await fetch("/data/ng-states-lgas.json")).json()).states; return ngCache; }

export const input = (props) => h("input", { type: "text", ...props });
export function select(options, value, props = {}) {
  const s = h("select", props, options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h("option", { value: v, selected: v === value }, l); }));
  return s;
}
export const allArms = (structure) => structure.classes.flatMap((c) => armsOf(c).map((a) => ({ cls: c.name, arm: a, key: classKey(c.name, a) })));
export const classLabel = (k) => String(k).replace("|", "");

/** Class + arm dropdown from the school's own list. */
export function classPicker(structure, value, { blank = "Choose class and arm" } = {}) {
  return select([["", blank], ...allArms(structure).map((c) => [c.key, classLabel(c.key)])], value || "");
}

/**
 * Role picker used at teacher registration and when the admin approves a teacher.
 * Class teacher: one class and arm. Subject teacher: exact (subject, class, arm) ticks, so Mathematics for SS2
 * does not add Mathematics for JSS3, and a JSS-only subject never appears for an SS class.
 * get() returns { classTeacher: {class, arm}|null, assignments: [{subject, class, arm}] }.
 */
export function rolePicker(structure, init = {}) {
  const ctSel = classPicker(structure, init.classTeacher ? classKey(init.classTeacher.class, init.classTeacher.arm) : "", { blank: "Not a class teacher" });
  const pairs = new Set((init.assignments || []).map((a) => `${a.subject}@@${classKey(a.class, a.arm)}`));
  const subjects = allSubjects(structure); const boxes = new Map(); const counts = new Map();
  const refresh = (sub) => { const n = [...pairs].filter((p) => p.startsWith(sub + "@@")).length; counts.get(sub).textContent = n ? `${n} class${n === 1 ? "" : "es"} selected` : ""; };
  const check = (label, checked, onchange) => { const i = h("input", { type: "checkbox", checked, onchange }); return { i, el: h("label", { class: "chk chk-sm" }, i, label) }; };
  const items = subjects.map((sub) => {
    const classes = classesForSubject(structure, sub); const count = h("span", { class: "hint" });
    counts.set(sub, count);
    const rows = classes.map((c) => {
      const arms = armsOf(c).map((a) => { const k = classKey(c.name, a); const x = check(a || "Whole class", pairs.has(`${sub}@@${k}`), (e) => { e.target.checked ? pairs.add(`${sub}@@${k}`) : pairs.delete(`${sub}@@${k}`); syncAll(); refresh(sub); }); boxes.set(`${sub}@@${k}`, x.i); return x; });
      const all = check("All", arms.every((x) => x.i.checked), (e) => { armsOf(c).forEach((a, i) => { const k = `${sub}@@${classKey(c.name, a)}`; arms[i].i.checked = e.target.checked; e.target.checked ? pairs.add(k) : pairs.delete(k); }); refresh(sub); });
      const syncAll = () => { all.i.checked = arms.every((x) => x.i.checked); };
      return h("div", { class: "cls-row" }, h("strong", {}, c.name), all.el, h("div", { class: "arm-list" }, arms.map((x) => x.el)));
    });
    refresh(sub);
    const d = h("details", { class: "subj", "data-name": sub.toLowerCase(), open: [...pairs].some((p) => p.startsWith(sub + "@@")) }, h("summary", {}, sub, " ", count), h("div", {}, rows));
    return d;
  });
  // Pairs that were saved earlier but are not offered by the school's current lists (for example Basic Science in SS2).
  // They are shown ticked so they can be unticked; before this, they stayed hidden and could not be removed.
  const offered = new Set(subjects.flatMap((sub) => classesForSubject(structure, sub).flatMap((c) => armsOf(c).map((a) => `${sub}@@${classKey(c.name, a)}`))));
  const orphans = [...pairs].filter((p) => !offered.has(p));
  const orphanBox = orphans.length ? h("fieldset", { class: "fs fs-warn" }, h("legend", {}, "Not offered in that class"),
    h("p", { class: "hint" }, "These were selected earlier, but the school does not teach the subject in that class. Untick any that are wrong."),
    orphans.map((p) => { const [sub, k] = p.split("@@"); return check(`${sub}, ${classLabel(k)}`, true, (e) => { e.target.checked ? pairs.add(p) : pairs.delete(p); }).el; })) : null;
  const q = h("input", { type: "search", placeholder: "Find a subject", "aria-label": "Find a subject", oninput: (e) => { const v = e.target.value.toLowerCase(); items.forEach((d) => (d.hidden = v && !d.dataset.name.includes(v))); } });
  const el = h("div", {}, field("Class teacher for", ctSel, "Takes the daily attendance register for this class and arm. Leave as it is if you are not a class teacher."),
    h("fieldset", { class: "fs" }, h("legend", {}, "Subjects you teach"), h("p", { class: "hint" }, "Open a subject and tick only the classes where you teach it. JSS and SS subjects are listed separately."), orphanBox, q, h("div", { class: "subj-list" }, items)));
  const get = () => {
    const [c, a] = ctSel.value ? ctSel.value.split("|") : [];
    const assignments = [...pairs].map((p) => { const [subject, k] = p.split("@@"); const { cls, arm } = splitKey(k); return { subject, class: cls, arm }; });
    return { classTeacher: c ? { class: c, arm: a } : null, assignments };
  };
  return { el, get };
}

export function msg(host, text, kind = "error") { host.textContent = text; host.className = `form-msg ${kind}`; host.hidden = !text; }
export const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = on ? "Please wait…" : label; };
export const friendlyAuthError = (e) => ({
  "auth/invalid-credential": "The email or password is not right.", "auth/wrong-password": "The email or password is not right.", "auth/user-not-found": "The email or password is not right.",
  "auth/email-already-in-use": "An account with this email already exists. Try logging in.", "auth/weak-password": "Choose a password with at least 8 characters.",
  "auth/invalid-email": "Enter a valid email address.", "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/unauthorized-domain": "This website address is not authorised in Firebase yet. See Common errors in FIREBASE_LOGIN_SETUP.md.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.", "auth/popup-closed-by-user": "The Google window was closed before finishing.",
  "auth/invalid-api-key": "The Firebase API key is wrong or restricted. See Common errors in FIREBASE_LOGIN_SETUP.md.", "auth/network-request-failed": "No internet connection. Check your data and try again.",
  "permission-denied": "You do not have permission to do that.",
}[e?.code] || e?.message || "Something went wrong. Try again.");
