// Firestore rules tests. Run inside GitHub Actions (npm run test:rules) with the Firebase emulator.
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, collection, where } from "firebase/firestore";

let env;
// Whatever UID is in the file (the placeholder or the real owner's), the tests use their own owner, "owner1".
const rules = readFileSync("firestore.rules", "utf8").replace(/function ownerUid\(\) \{ return '[^']*'; \}/, "function ownerUid() { return 'owner1'; }");
if (!rules.includes("return 'owner1'")) throw new Error("Could not find ownerUid() in firestore.rules");
const as = (uid, claims = {}) => env.authenticatedContext(uid, { email_verified: true, email: `${uid}@example.com`, ...claims }).firestore();
const T = (extra) => ({ role: "teacher", schoolId: "s1", status: "active", classKeys: [], assignments: [], classTeacherKey: null, ...extra });

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: "termbook-test", firestore: { rules } }); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const seed = {
      "config/platform": { requireVerification: true },
      "publicSchools/s1": { name: "One", state: "Lagos", lga: "Ikeja" },
      "schools/s1": { adminUid: "adm1", status: "verified", name: "One" },
      "schools/s2": { adminUid: "adm2", status: "verified", name: "Two" },
      "users/adm1": { uid: "adm1", role: "admin", schoolId: "s1", status: "active" },
      "users/adm2": { uid: "adm2", role: "admin", schoolId: "s2", status: "active" },
      "users/pending": { uid: "pending", ...T({ status: "pending" }) },
      "users/ctch": { uid: "ctch", ...T({ classTeacherKey: "SS1|A", classKeys: ["SS1|A"] }) },
      "users/subj": { uid: "subj", ...T({ assignments: ["Mathematics|SS2|A"], classKeys: ["SS2|A"] }) },
      "users/other": { uid: "other", ...T({ schoolId: "s2", classTeacherKey: "SS1|A", classKeys: ["SS1|A"] }) },
      "users/parent1": { uid: "parent1", role: "parent", status: "active" },
      "users/parent2": { uid: "parent2", role: "parent", status: "active" },
      "schools/s1/students/st1": { name: "A", classKey: "SS2|A", class: "SS2", arm: "A", admissionNo: "A1", status: "active" },
      "schools/s1/students/st2": { name: "B", classKey: "SS1|A", class: "SS1", arm: "A", admissionNo: "B1", status: "active" },
      "schools/s1/students/st1/private/info": { religion: "x", phone: "0803" },
      "schools/s1/accessCodes/st1": { code: "ABC123", active: true, studentId: "st1" },
      "schools/s1/terms/t1": { published: false },
      "schools/s1/terms/t2": { published: true },
      "schools/s1/links/parent1_st1": { uid: "parent1", studentId: "st1", code: "ABC123" },
      "schools/s1/reports/t1_st1": { termId: "t1", studentId: "st1", classKey: "SS2|A" },
      "schools/s1/reports/t2_st1": { termId: "t2", studentId: "st1", classKey: "SS2|A" },
      "schools/s1/sheets/math": { subject: "Mathematics", classKey: "SS2|A", scores: {} },
      "schools/s1/sheets/eng": { subject: "English", classKey: "SS2|A", scores: {} },
    };
    for (const [p, d] of Object.entries(seed)) await setDoc(doc(db, p), d);
  });
});

describe("required rules", () => {
  it("a teacher cannot read another school", async () => {
    const db = as("other");
    await assertFails(getDoc(doc(db, "schools/s1")));
    await assertFails(getDoc(doc(db, "schools/s1/students/st2")));
    await assertFails(getDocs(query(collection(db, "schools/s1/students"), where("classKey", "==", "SS1|A"))));
  });
  it("an unapproved teacher reads nothing", async () => {
    const db = as("pending");
    await assertFails(getDoc(doc(db, "schools/s1")));
    await assertFails(getDoc(doc(db, "schools/s1/students/st1")));
    await assertFails(getDoc(doc(db, "schools/s1/sheets/math")));
  });
  it("a class teacher cannot write scores", async () => {
    await assertFails(updateDoc(doc(as("ctch"), "schools/s1/sheets/math"), { scores: { 1: {} } }));
  });
  it("a subject teacher cannot write another subject's scores, but can write their own", async () => {
    const db = as("subj");
    await assertFails(updateDoc(doc(db, "schools/s1/sheets/eng"), { scores: { 1: {} } }));
    await assertSucceeds(updateDoc(doc(db, "schools/s1/sheets/math"), { scores: { 1: { st1: { a: 5 } } } }));
  });
  it("a parent sees only the linked child, and only published results", async () => {
    const db = as("parent1");
    await assertSucceeds(getDoc(doc(db, "schools/s1/students/st1")));
    await assertFails(getDoc(doc(db, "schools/s1/students/st2")));
    await assertFails(getDoc(doc(db, "schools/s1/students/st1/private/info")));
    await assertFails(getDoc(doc(db, "schools/s1/reports/t1_st1")));
    await assertSucceeds(getDoc(doc(db, "schools/s1/reports/t2_st1")));
    await assertFails(getDoc(doc(db, "schools/s1/sheets/math")));
  });
});

describe("student management", () => {
  it("the school admin can promote and tag a student as no longer in school; another school's admin cannot", async () => {
    await assertSucceeds(updateDoc(doc(as("adm1"), "schools/s1/students/st1"), { class: "SS3", classKey: "SS3|A", status: "active" }));
    await assertSucceeds(updateDoc(doc(as("adm1"), "schools/s1/students/st2"), { status: "left", leftReason: "Withdrawn" }));
    await assertFails(updateDoc(doc(as("adm2"), "schools/s1/students/st1"), { status: "left" }));
  });
  it("the owner can read and edit any school's students", async () => {
    await assertSucceeds(getDoc(doc(as("owner1"), "schools/s1/students/st1")));
    await assertSucceeds(updateDoc(doc(as("owner1"), "schools/s1/students/st1"), { status: "left" }));
  });
  it("students are never hard-deleted, even by the admin", async () => {
    await assertFails(deleteDoc(doc(as("adm1"), "schools/s1/students/st1")));
  });
  it("a class teacher adds pending students to their own class only and cannot change status", async () => {
    const db = as("ctch");
    await assertSucceeds(setDoc(doc(db, "schools/s1/students/new1"), { name: "N", classKey: "SS1|A", status: "pending" }));
    await assertFails(setDoc(doc(db, "schools/s1/students/new2"), { name: "N", classKey: "SS1|A", status: "active" }));
    await assertFails(setDoc(doc(db, "schools/s1/students/new3"), { name: "N", classKey: "SS2|A", status: "pending" }));
    await assertFails(updateDoc(doc(db, "schools/s1/students/st2"), { status: "left" }));
  });
  it("a subject teacher can list only the classes they teach", async () => {
    const db = as("subj");
    await assertSucceeds(getDocs(query(collection(db, "schools/s1/students"), where("classKey", "==", "SS2|A"))));
    await assertFails(getDocs(query(collection(db, "schools/s1/students"), where("classKey", "==", "SS1|A"))));
  });
});

describe("accounts and links", () => {
  it("a teacher cannot approve themselves or change their roles", async () => {
    await assertFails(updateDoc(doc(as("pending"), "users/pending"), { status: "active" }));
    await assertFails(updateDoc(doc(as("ctch"), "users/ctch"), { classKeys: ["SS3|A"] }));
  });
  it("the admin can approve a teacher in their school only", async () => {
    await assertSucceeds(updateDoc(doc(as("adm1"), "users/pending"), { status: "active", classKeys: ["JSS1|A"], classTeacherKey: "JSS1|A" }));
    await assertFails(updateDoc(doc(as("adm2"), "users/pending"), { status: "active" }));
  });
  it("nobody can register as the owner", async () => {
    await assertFails(setDoc(doc(as("rando"), "users/rando"), { uid: "rando", role: "owner", status: "active" }));
    await assertSucceeds(setDoc(doc(as("owner1"), "users/owner1"), { uid: "owner1", role: "owner", status: "active" }));
  });
  it("an unverified email gets no access", async () => {
    const db = env.authenticatedContext("adm1", { email_verified: false }).firestore();
    await assertFails(getDoc(doc(db, "schools/s1")));
  });
  it("a parent links only with the right code, and the code is never readable", async () => {
    const db = as("parent2");
    await assertFails(setDoc(doc(db, "schools/s1/links/parent2_st1"), { uid: "parent2", studentId: "st1", code: "WRONG" }));
    await assertFails(getDoc(doc(db, "schools/s1/accessCodes/st1")));
    await assertSucceeds(setDoc(doc(db, "schools/s1/links/parent2_st1"), { uid: "parent2", studentId: "st1", code: "ABC123" }));
  });
  it("revoking a link removes the parent's access", async () => {
    await assertSucceeds(deleteDoc(doc(as("adm1"), "schools/s1/links/parent1_st1")));
    await assertFails(getDoc(doc(as("parent1"), "schools/s1/students/st1")));
  });
  it("audit entries can be added but never edited or deleted", async () => {
    const db = as("adm1");
    await assertSucceeds(setDoc(doc(db, "audit/a1"), { uid: "adm1", schoolId: "s1", action: "x" }));
    await assertFails(updateDoc(doc(db, "audit/a1"), { action: "y" }));
    await assertFails(deleteDoc(doc(db, "audit/a1")));
  });
});
