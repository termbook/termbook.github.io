import { h, field } from "../lib/dom.js";
import { classKey } from "../lib/students.js";

let ngCache;
export async function loadNg() { if (!ngCache) ngCache = (await (await fetch("/data/ng-states-lgas.json")).json()).states; return ngCache; }

export const input = (props) => h("input", { type: "text", ...props });
export function select(options, value, props = {}) {
  const s = h("select", props, options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h("option", { value: v, selected: v === value }, l); }));
  return s;
}
export const allArms = (structure) => structure.classes.flatMap((c) => c.arms.map((a) => ({ cls: c.name, arm: a, key: classKey(c.name, a) })));
export const classLabel = (k) => String(k).replace("|", "");

/** Class + arm dropdown from the school's own list. */
export function classPicker(structure, value, { blank = "Choose class and arm" } = {}) {
  return select([["", blank], ...allArms(structure).map((c) => [c.key, classLabel(c.key)])], value || "");
}

/**
 * Role picker used at teacher registration and when the admin approves a teacher.
 * get() returns { classTeacher: {class, arm}|null, assignments: [{subject, class, arm}] }.
 */
export function rolePicker(structure, init = {}) {
  const ctSel = classPicker(structure, init.classTeacher ? classKey(init.classTeacher.class, init.classTeacher.arm) : "", { blank: "Not a class teacher" });
  const subjSet = new Set((init.assignments || []).map((a) => a.subject));
  const clsSet = new Set((init.assignments || []).map((a) => classKey(a.class, a.arm)));
  const box = (label, checked, onchange) => h("label", { class: "chk" }, h("input", { type: "checkbox", checked, onchange }), label);
  const subjects = h("div", { class: "chk-grid" }, structure.subjects.map((s) => box(s, subjSet.has(s), (e) => (e.target.checked ? subjSet.add(s) : subjSet.delete(s)))));
  const classes = h("div", { class: "chk-grid" }, allArms(structure).map((c) => box(classLabel(c.key), clsSet.has(c.key), (e) => (e.target.checked ? clsSet.add(c.key) : clsSet.delete(c.key)))));
  const el = h("div", {}, field("Class teacher for", ctSel, "Takes the daily attendance register for this class and arm."),
    h("fieldset", { class: "fs" }, h("legend", {}, "Subjects you teach"), subjects),
    h("fieldset", { class: "fs" }, h("legend", {}, "Classes you teach them in"), classes));
  const get = () => {
    const [c, a] = ctSel.value ? ctSel.value.split("|") : [];
    const assignments = [];
    for (const s of subjSet) for (const k of clsSet) { const [cl, ar] = k.split("|"); assignments.push({ subject: s, class: cl, arm: ar }); }
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
