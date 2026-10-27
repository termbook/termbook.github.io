import { h, field, mount, toast } from "../lib/dom.js";
import { auth } from "../lib/firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendEmailVerification, sendPasswordResetEmail, signOut } from "firebase/auth";
import { input, select, msg, busy, friendlyAuthError, loadNg, rolePicker } from "./common.js";
import { registerAdmin, registerTeacher, registerParent, publicSchools, DEFAULT_STRUCTURE } from "../lib/data.js";
import { validPhone } from "../lib/dates.js";
import { dateSelect } from "../lib/datepick.js";

const CONSENT_VERSION = "draft-1";
const card = (...k) => h("div", { class: "card authcard" }, ...k);
const consentBox = () => h("label", { class: "chk consent" }, h("input", { type: "checkbox", id: "consent" }),
  h("span", {}, "I have read the ", h("a", { href: "/privacy.html", target: "_blank", rel: "noopener" }, "privacy notice (draft)"), " and agree that Termbook may process this information to run the service, in line with the Nigeria Data Protection Act 2023."));

export function authView(kind) {
  const isLogin = kind === "login";
  const email = input({ id: "em", type: "email", autocomplete: "email", required: true, inputmode: "email" });
  const pw = input({ id: "pw", type: "password", autocomplete: isLogin ? "current-password" : "new-password", required: true });
  const out = h("p", { role: "alert", hidden: true });
  const go = h("button", { class: "btn btn-primary btn-block", type: "submit" }, isLogin ? "Log in" : "Create account");
  const form = h("form", { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); msg(out, "");
    if (!email.value.trim() || !pw.value) return msg(out, "Enter your email and password.");
    if (!isLogin && pw.value.length < 8) return msg(out, "Choose a password with at least 8 characters.");
    busy(go, true, "");
    try {
      if (isLogin) await signInWithEmailAndPassword(auth, email.value.trim(), pw.value);
      else { const c = await createUserWithEmailAndPassword(auth, email.value.trim(), pw.value); await sendEmailVerification(c.user); }
    } catch (err) { msg(out, friendlyAuthError(err)); busy(go, false, ""); go.textContent = isLogin ? "Log in" : "Create account"; }
  } }, field("Email", email), field("Password", pw, isLogin ? null : "At least 8 characters."), out, go);
  const google = h("button", { class: "btn btn-block", type: "button", onclick: async () => {
    msg(out, ""); try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (err) { msg(out, friendlyAuthError(err)); }
  } }, "Continue with Google");
  return card(h("h1", {}, isLogin ? "Log in" : "Create your account"),
    !isLogin ? h("p", { class: "muted" }, "First create an account. Next you choose whether you are a school admin, a teacher or a parent.") : null,
    form, h("div", { class: "or" }, "or"), google,
    h("p", { class: "links" }, isLogin ? [h("a", { href: "#/forgot" }, "Forgot password?"), " · ", h("a", { href: "#/register" }, "Create an account")] : [h("a", { href: "#/login" }, "I already have an account")]));
}

export function forgotView() {
  const email = input({ id: "fe", type: "email", autocomplete: "email" }); const out = h("p", { role: "status", hidden: true });
  return card(h("h1", {}, "Reset your password"), h("p", { class: "muted" }, "We will email you a link to choose a new password."),
    h("form", { novalidate: true, onsubmit: async (e) => { e.preventDefault(); try { await sendPasswordResetEmail(auth, email.value.trim()); msg(out, "If that email has an account, a reset link is on its way. Check your inbox and spam folder.", "ok"); } catch (err) { msg(out, friendlyAuthError(err)); } } },
      field("Email", email), out, h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Send reset link")),
    h("p", { class: "links" }, h("a", { href: "#/login" }, "Back to log in")));
}

export function verifyView(user, onDone) {
  const out = h("p", { role: "status", hidden: true });
  return card(h("h1", {}, "Check your email"), h("p", {}, "We sent a verification link to ", h("strong", {}, user.email), ". Open it, then come back and press the button below."),
    out,
    h("div", { class: "stack" },
      h("button", { class: "btn btn-primary", type: "button", onclick: async () => { await user.reload(); if (user.emailVerified) { await user.getIdToken(true); onDone(); } else msg(out, "Not verified yet. Open the link in the email first.", "error"); } }, "I have verified my email"),
      h("button", { class: "btn", type: "button", onclick: async () => { try { await sendEmailVerification(user); msg(out, "Sent again. Check your inbox and spam folder.", "ok"); } catch (e) { msg(out, friendlyAuthError(e)); } } }, "Send the link again"),
      h("button", { class: "btn", type: "button", onclick: () => signOut(auth) }, "Use a different account")));
}

export function waitingView(kind, user) {
  const t = { pending: ["Waiting for approval", "Your school's admin must approve you before you can see any school data. Ask them to open Teachers and approve your request."],
    rejected: ["Request not approved", "Your school's admin did not approve this request. Speak to them if you think this is a mistake."],
    school: ["School waiting for verification", "The platform owner has not verified your school yet. Teachers can find your school only after it is verified. You can set up classes and subjects meanwhile."] }[kind];
  return card(h("h1", {}, t[0]), h("p", {}, t[1]), h("button", { class: "btn", type: "button", onclick: () => signOut(auth) }, "Log out"));
}

/** After verification, before a profile exists: choose a role and complete it. */
export function onboardingView(user, onDone) {
  const host = h("div", {});
  const pick = () => mount(host, card(h("h1", {}, "Who are you?"),
    h("div", { class: "stack" },
      h("button", { class: "btn btn-primary", type: "button", onclick: () => adminForm() }, "I am registering a school"),
      h("button", { class: "btn", type: "button", onclick: () => teacherForm() }, "I am a teacher joining my school"),
      h("button", { class: "btn", type: "button", onclick: () => parentForm() }, "I am a parent or student"),
      h("button", { class: "btn btn-quiet", type: "button", onclick: () => signOut(auth) }, "Log out"))));
  const personal = (nameHint = "Surname first, e.g. ADEBAYO Temitope") => {
    const name = input({ id: "pn", placeholder: nameHint, autocomplete: "name" }); const phone = input({ id: "pp", type: "tel", placeholder: "08031234567 or +2348031234567", autocomplete: "tel" }); const dob = dateSelect({ id: "pd", label: "Date of birth", from: new Date().getFullYear() - 80, to: new Date().getFullYear() - 16 });
    return { name, phone, dob, el: [field("Full name (surname first)", name), field("Phone number", phone), field("Date of birth", dob)] };
  };
  const checkPersonal = (p, out) => {
    if (!p.name.value.trim()) return msg(out, "Enter your full name."), null;
    if (!validPhone(p.phone.value)) return msg(out, "Enter a valid Nigerian phone number."), null;
    const dob = p.dob.value; if (!dob) return msg(out, p.dob.partial ? "Choose the day, month and year of your date of birth." : "Choose your date of birth."), null;
    if (!document.getElementById("consent").checked) return msg(out, "Please tick the consent box to continue."), null;
    return { name: p.name.value.trim(), phone: p.phone.value.replace(/[\s-]/g, ""), dob };
  };
  const consent = () => ({ version: CONSENT_VERSION, at: new Date().toISOString() });
  const back = h("button", { class: "btn btn-quiet", type: "button", onclick: pick }, "Back");

  async function adminForm() {
    const ng = await loadNg(); const out = h("p", { role: "alert", hidden: true });
    const sn = input({ id: "sn", placeholder: "School name" }); const st = select(["", ...ng.map((s) => s.name)], "", { id: "ss" }); const lga = select([""], "", { id: "sl" });
    st.addEventListener("change", () => { const l = ng.find((s) => s.name === st.value)?.lgas || []; lga.replaceChildren(...["", ...l].map((x) => h("option", { value: x }, x || "Choose local government"))); });
    st.firstChild.textContent = "Choose state";
    const ty = select([["", "Choose type"], ["public", "Public"], ["private", "Private"], ["mission", "Mission"]], ""); const addr = input({ id: "sa" }); const sp = input({ id: "sph", type: "tel" }); const se = input({ id: "se", type: "email" });
    const p = personal(); const go = h("button", { class: "btn btn-primary", type: "submit" }, "Register school");
    mount(host, card(h("h1", {}, "Register your school"), h("form", { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); msg(out, "");
      if (!sn.value.trim() || !st.value || !lga.value || !ty.value || !addr.value.trim()) return msg(out, "Fill in the school name, type, state, local government and address.");
      if (!validPhone(sp.value)) return msg(out, "Enter a valid school phone number.");
      if (!/^\S+@\S+\.\S+$/.test(se.value)) return msg(out, "Enter a valid school email.");
      const a = checkPersonal(p, out); if (!a) return;
      busy(go, true, "Register school");
      try { await registerAdmin({ user, admin: a, school: { name: sn.value.trim(), type: ty.value, state: st.value, lga: lga.value, address: addr.value.trim(), phone: sp.value.replace(/[\s-]/g, ""), email: se.value.trim() }, consent: consent() }); onDone(); }
      catch (err) { msg(out, friendlyAuthError(err)); busy(go, false, "Register school"); }
    } }, h("h2", {}, "School"), field("School name", sn), field("Type", ty), field("State", st), field("Local government", lga), field("Address", addr), field("School phone", sp), field("School email", se),
      h("h2", {}, "Your details"), p.el, consentBox(), out, h("div", { class: "stack" }, go, back))));
  }

  async function teacherForm() {
    const ng = await loadNg(); const schools = await publicSchools().catch(() => []); const out = h("p", { role: "alert", hidden: true });
    const st = select([["", "Choose state"], ...ng.map((s) => s.name)], ""); const lga = select([["", "Choose local government"]], ""); const sch = select([["", "Choose school"]], "");
    const roleHost = h("div", {}); let picker = null; let chosen = null;
    st.addEventListener("change", () => { lga.replaceChildren(...[["", "Choose local government"], ...(ng.find((s) => s.name === st.value)?.lgas || [])].map((x) => { const [v, l] = Array.isArray(x) ? x : [x, x]; return h("option", { value: v }, l); })); sch.replaceChildren(h("option", { value: "" }, "Choose school")); roleHost.replaceChildren(); });
    lga.addEventListener("change", () => { const l = schools.filter((s) => s.state === st.value && s.lga === lga.value).sort((a, b) => a.name.localeCompare(b.name)); sch.replaceChildren(...[h("option", { value: "" }, l.length ? "Choose school" : "No verified schools here yet"), ...l.map((s) => h("option", { value: s.id }, s.name))]); });
    sch.addEventListener("change", () => { chosen = schools.find((s) => s.id === sch.value); picker = chosen ? rolePicker(chosen.structure || DEFAULT_STRUCTURE) : null; roleHost.replaceChildren(...(picker ? [picker.el] : [])); });
    const p = personal(); const go = h("button", { class: "btn btn-primary", type: "submit" }, "Send request");
    mount(host, card(h("h1", {}, "Join your school"), h("form", { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); msg(out, "");
      if (!chosen) return msg(out, "Choose your state, local government and school.");
      const r = picker.get(); if (!r.classTeacher && !r.assignments.length) return msg(out, "Choose a class you are class teacher for, or subjects and classes you teach.");
      const a = checkPersonal(p, out); if (!a) return;
      busy(go, true, "Send request");
      try { await registerTeacher({ user, teacher: a, schoolId: chosen.id, requested: { classTeacher: r.classTeacher, assignments: r.assignments }, consent: consent() }); onDone(); }
      catch (err) { msg(out, friendlyAuthError(err)); busy(go, false, "Send request"); }
    } }, h("h2", {}, "Your school"), field("State", st), field("Local government", lga), field("School", sch), h("h2", {}, "Your roles"), roleHost, h("h2", {}, "Your details"), p.el, consentBox(), out, h("div", { class: "stack" }, go, back))));
  }

  function parentForm() {
    const out = h("p", { role: "alert", hidden: true }); const name = input({ id: "pn", autocomplete: "name" }); const phone = input({ id: "pp", type: "tel" });
    const go = h("button", { class: "btn btn-primary", type: "submit" }, "Continue");
    mount(host, card(h("h1", {}, "Parent or student"), h("p", { class: "muted" }, "You will link your child with the school's access code on the next screen."),
      h("form", { novalidate: true, onsubmit: async (e) => {
        e.preventDefault(); if (!name.value.trim()) return msg(out, "Enter your name."); if (!document.getElementById("consent").checked) return msg(out, "Please tick the consent box to continue.");
        busy(go, true, "Continue"); try { await registerParent({ user, name: name.value.trim(), phone: phone.value.replace(/[\s-]/g, ""), consent: consent() }); onDone(); } catch (err) { msg(out, friendlyAuthError(err)); busy(go, false, "Continue"); }
      } }, field("Your name", name), field("Phone (optional)", phone), consentBox(), out, h("div", { class: "stack" }, go, back))));
  }
  pick(); return host;
}
