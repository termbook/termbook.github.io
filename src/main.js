import { h, mount, empty, toast } from "./lib/dom.js";
import { initTheme } from "./lib/theme.js";
import { configured, auth } from "./lib/firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { state, roleOf } from "./lib/store.js";
import { APP_NAME } from "./lib/config.js";
import { loadProfile, loadSchool, tryBootstrapOwner } from "./lib/data.js";
import { authView, forgotView, verifyView, waitingView, onboardingView } from "./views/auth.js";
import { overviewView, teachersView, setupView } from "./views/admin.js";
import { studentsView, stopStudents } from "./views/students.js";
import { attendanceView, stopAttendance } from "./views/attendance.js";
import { scoresView, stopScores } from "./views/scores.js";
import { reportsView, stopReports } from "./views/reports.js";
import { parentView } from "./views/parent.js";
import { progressView } from "./views/progress.js";
import { ownerSchoolsView, auditView, ownerSettingsView } from "./views/owner.js";

const ICONS = { home: "M3 11l9-8 9 8M5 10v10h14V10", school: "M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6", people: "M16 11a3 3 0 100-6 3 3 0 000 6zM8 12a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5", check: "M4 4h16v16H4zM8 12l3 3 5-6", sheet: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7", log: "M4 6h16M4 12h16M4 18h10", gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-1V5H9v2L7 8 5 7l-2 4 2 1v2l-2 1 2 4 2-1 2 1v2h6v-2l2-1 2 1 2-4-2-1z", child: "M12 8a3 3 0 100-6 3 3 0 000 6zM5 21c0-4 3-7 7-7s7 3 7 7", report: "M5 3h14v18H5zM9 8h6M9 12h6M9 16h4", chart: "M4 20V10M10 20V4M16 20v-7M22 20H2" };
const NAV = {
  owner: [["#/owner/schools", "Schools", "school"], ["#/owner/audit", "Audit", "log"], ["#/owner/settings", "Settings", "gear"]],
  admin: [["#/admin", "Overview", "home"], ["#/admin/students", "Students", "people"], ["#/admin/teachers", "Teachers", "school"], ["#/admin/attendance", "Attendance", "check"], ["#/admin/scores", "Scores", "sheet"], ["#/admin/progress", "Progress", "chart"], ["#/admin/reports", "Reports", "report"], ["#/admin/setup", "Setup", "gear"], ["#/admin/audit", "Audit", "log"]],
  teacher: [["#/teacher/attendance", "Attendance", "check"], ["#/teacher/scores", "Scores", "sheet"], ["#/teacher/progress", "Progress", "chart"], ["#/teacher/reports", "Reports", "report"], ["#/teacher/students", "Students", "people"]],
  parent: [["#/parent", "My child", "child"]],
};
const $ = (s) => document.querySelector(s); const view = $("#view"), shell = $("#shell");
const svg = (d) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.append(p); return s; };
function navRole() { return state.isOwner && state.schoolId ? "admin" : roleOf(); }
// Subject teachers do not see Reports; report cards belong to the class teacher of the class.
const navItems = (role) => (role === "teacher" && !state.profile?.classTeacherKey ? NAV.teacher.filter((n) => n[1] !== "Reports") : NAV[role] || []);
function buildNav() {
  const items = navItems(navRole()); const tabs = items.slice(0, 5); const more = items.length > 5;
  for (const [host, list] of [[$("#side-nav"), items], [$("#tab-nav"), more ? tabs.slice(0, 4) : tabs]]) { host.replaceChildren(...list.map(([href, label, ic]) => h("a", { href }, svg(ICONS[ic]), label))); }
  if (more) $("#tab-nav").append(h("a", { href: "#/more" }, svg(ICONS.gear), "More"));
  if (state.isOwner && state.schoolId) $("#side-nav").prepend(h("a", { href: "#/owner/schools", onclick: () => { state.schoolId = null; state.school = null; buildNav(); } }, svg(ICONS.school), "All schools"));
}
function stopAll() { stopStudents(); stopAttendance(); stopScores(); stopReports(); }
function setBare(on) { shell.classList.toggle("bare", on); $("#signout").hidden = on; }

async function route() {
  stopAll(); const full = location.hash || "#/login"; const [, a, b, c] = full.split("/"); const path = `#/${a || ""}${b ? "/" + b : ""}`;
  if (!state.user) { setBare(true); document.title = APP_NAME; return mount(view, a === "register" ? authView("register") : a === "forgot" ? forgotView() : authView("login")); }
  if (!state.profile && !state.isOwner) return; // onboarding handled by boot
  const role = navRole(); const items = navItems(role);
  if (full === "#/more") return mount(view, h("h1", {}, "More"), h("div", { class: "list" }, items.map(([href, label]) => h("a", { class: "row-card", href }, label))));
  if (!items.some((n) => n[0] === path)) { location.hash = items[0][0]; return; }
  $("#school-name").textContent = state.school?.name || (state.isOwner ? "Platform owner" : "");
  document.querySelectorAll("#side-nav a,#tab-nav a").forEach((x) => { const on = x.getAttribute("href") === path; on ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current"); });
  document.title = `${items.find((n) => n[0] === path)?.[1] || APP_NAME} | ${APP_NAME}`;
  try {
    if (role === "parent") return await parentView(view);
    if (state.isOwner && !state.schoolId) { if (b === "audit") return await auditView(view); if (b === "settings") return await ownerSettingsView(view); return await ownerSchoolsView(view, manageSchool); }
    const sec = b || ""; const tab = c;
    if (sec === "audit") return await auditView(view);
    if (a === "admin" || state.isOwner) { if (sec === "") return await overviewView(view); if (sec === "teachers") return await teachersView(view); if (sec === "setup") return await setupView(view); }
    if (sec === "students") return studentsView(view); if (sec === "attendance") return await attendanceView(view, tab || "register"); if (sec === "scores") return await scoresView(view); if (sec === "reports") return await reportsView(view); if (sec === "progress") return await progressView(view);
  } catch (e) { console.error(e); mount(view, empty("Something went wrong", e?.message || "Try again.")); }
}
async function manageSchool(sc) { state.schoolId = sc.id; state.school = sc; buildNav(); location.hash = "#/admin"; route(); }

async function boot() {
  initTheme($("#theme")); $("#signout").addEventListener("click", () => signOut(auth));
  const net = () => { $("#net").textContent = navigator.onLine ? "Online" : "Offline"; $("#net").dataset.offline = navigator.onLine ? "" : "1"; }; addEventListener("online", net); addEventListener("offline", net); net();
  if (!configured) { setBare(true); return mount(view, h("div", { class: "card authcard" }, h("h1", {}, "Not connected yet"), h("p", {}, "This copy of Termbook has no Firebase settings. Follow docs/FIREBASE_LOGIN_SETUP.md, add the six repository secrets, then run the deployment again."))); }
  addEventListener("hashchange", route);
  onAuthStateChanged(auth, async (user) => {
    Object.assign(state, { user, profile: null, school: null, isOwner: false, schoolId: null });
    if (!user) { setBare(true); return route(); }
    const passwordUser = user.providerData.every((p) => p.providerId === "password");
    if (passwordUser && !user.emailVerified) { setBare(true); return mount(view, verifyView(user, () => location.reload())); }
    try {
      let p = await loadProfile(user.uid);
      if (!p) { if (await tryBootstrapOwner(user)) p = await loadProfile(user.uid); }
      if (!p) { setBare(true); return mount(view, onboardingView(user, () => location.reload())); }
      state.profile = p; state.isOwner = p.role === "owner";
      if (p.role === "admin" && p.status !== "active") { setBare(true); return mount(view, waitingView("removed")); }
      if (p.role === "teacher" && p.status !== "active") { setBare(true); return mount(view, waitingView(p.status === "rejected" ? "rejected" : "pending")); }
      if ((p.role === "admin" || p.role === "teacher") && p.schoolId) state.school = await loadSchool(p.schoolId);
      if (p.role === "teacher" && state.school?.status === "pending") state.school.banner = true;
    } catch (e) { setBare(true); return mount(view, empty("Cannot load your account", e?.message || "Check your connection and try again.")); }
    setBare(false); buildNav(); if (!location.hash || /^#\/(login|register|forgot)/.test(location.hash)) location.hash = navItems(navRole())[0][0]; route();
  });
}
boot();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
