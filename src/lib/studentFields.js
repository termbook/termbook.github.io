/**
 * One list of every student detail. The Add/Edit form, the CSV and Excel import and the downloadable template
 * are all built from it, so they always carry the same entries.
 * store "student": kept on the student record (visible to staff of the class and the linked parent).
 * store "private": kept in the private record, visible only to the school admin, the owner and that class's teacher.
 */
export const SELECTS = {
  gender: ["Male", "Female"],
  relationship: ["Father", "Mother", "Guardian", "Other"],
  bloodGroup: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
  genotype: ["AA", "AS", "SS", "AC", "SC", "Unknown"],
  transport: ["Walks", "School bus", "Driven by parent", "Public transport", "Other"],
  boarding: ["Day", "Boarding"],
};

// group, key, label (also the template heading), type, store, extra aliases (normalised: lower case, letters and digits only)
const F = (group, key, label, type, store, aliases = [], options) => ({ group, key, label, type, store, aliases, options });
export const FIELDS = [
  F("student", "admissionDate", "Admission date", "date", "student", ["dateofadmission", "admitted"]),
  F("student", "stateOfOrigin", "State of origin", "state", "private", ["state"]),
  F("student", "lgaOfOrigin", "LGA of origin", "lga", "private", ["lga", "localgovernment", "localgovernmentofarea"]),
  F("student", "nationality", "Nationality", "text", "private"),
  F("student", "previousSchool", "Previous school", "text", "private", ["lastschool", "schoolattendedbefore"]),
  F("student", "address", "Home address", "textarea", "private", ["address", "residentialaddress"]),
  F("contact", "parentName", "Parent/guardian name", "text", "student", ["parentname", "guardianname", "parentorguardian", "parentguardian"]),
  F("contact", "relationship", "Relationship to student", "select", "private", ["relationship", "contactrelationship"], SELECTS.relationship),
  F("contact", "phone", "Parent/guardian phone", "tel", "private", ["parentphone", "guardianphone", "phone", "phonenumber", "mobile", "parentphonenumber"]),
  F("contact", "email", "Parent/guardian email", "email", "private", ["parentemail", "guardianemail", "email"]),
  F("family", "fatherName", "Father's name", "text", "private", ["fathername", "father"]),
  F("family", "fatherPhone", "Father's phone", "tel", "private", ["fatherphone"]),
  F("family", "fatherOccupation", "Father's occupation", "text", "private", ["fatheroccupation"]),
  F("family", "motherName", "Mother's name", "text", "private", ["mothername", "mother"]),
  F("family", "motherPhone", "Mother's phone", "tel", "private", ["motherphone"]),
  F("family", "motherOccupation", "Mother's occupation", "text", "private", ["motheroccupation"]),
  F("emergency", "emergencyName", "Emergency contact name", "text", "private", ["emergencycontact", "emergencyname"]),
  F("emergency", "emergencyRelationship", "Emergency contact relationship", "text", "private", ["emergencyrelationship"]),
  F("emergency", "emergencyPhone", "Emergency contact phone", "tel", "private", ["emergencyphone"]),
  F("health", "bloodGroup", "Blood group", "select", "private", ["bloodtype"], SELECTS.bloodGroup),
  F("health", "genotype", "Genotype", "select", "private", [], SELECTS.genotype),
  F("health", "allergies", "Allergies", "textarea", "private", ["knownallergies"]),
  F("health", "medicalConditions", "Medical conditions", "textarea", "private", ["healthconditions", "medicalcondition", "illness"]),
  F("health", "medications", "Regular medication", "textarea", "private", ["medication", "medications", "drugs"]),
  F("health", "disability", "Special needs or disability", "textarea", "private", ["disability", "specialneeds"]),
  F("health", "doctorHospital", "Doctor or hospital", "text", "private", ["doctor", "hospital", "familydoctor"]),
  F("health", "healthNotes", "Other health notes", "textarea", "private", ["healthnotes"]),
  F("other", "transport", "How the student gets to school", "select", "private", ["transport", "modeoftransport"], SELECTS.transport),
  F("other", "boarding", "Day or boarding", "select", "private", ["dayorboarding", "boardingstatus"], SELECTS.boarding),
  F("other", "siblings", "Brothers or sisters in the school", "text", "private", ["siblings", "siblingsinschool"]),
  F("other", "notes", "Other notes", "textarea", "private", ["note", "remarks"]),
];
export const GROUPS = [
  ["student", "Student details"], ["contact", "Parent or guardian (main contact)"], ["family", "Father and mother (optional)"],
  ["emergency", "Emergency contact"], ["health", "Health (private)"], ["other", "Other"],
];
/** Columns every template and import starts with. Class and arm place the student; the rest are in FIELDS. */
export const BASE_COLUMNS = ["Name", "Gender", "Class", "Arm", "Admission no.", "Repeater", "Date of birth"];
const withoutBase = (k) => k;
export const TEMPLATE_HEADERS = [...BASE_COLUMNS.slice(0, 5), "Admission date", ...BASE_COLUMNS.slice(5), ...FIELDS.filter((f) => f.key !== "admissionDate").map((f) => f.label)].map(withoutBase);

export const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const fieldIndex = (() => { const m = new Map(); for (const f of FIELDS) for (const a of [norm(f.label), norm(f.key), ...f.aliases]) if (!m.has(a)) m.set(a, f.key); return m; })();
export const fieldByKey = (key) => FIELDS.find((f) => f.key === key);
/** Matches a heading cell to one of the extra fields, or undefined. */
export const fieldForHeader = (cell) => fieldIndex.get(norm(cell));
export const optionMatch = (field, v) => { const n = norm(v); return field.options?.find((o) => norm(o) === n) || ""; };

/** Splits cleaned extra values into what goes on the student record and what goes in the private record. */
export function splitExtra(extra = {}) {
  const student = {}, priv = {};
  for (const [k, v] of Object.entries(extra)) { const f = fieldByKey(k); if (f) (f.store === "student" ? student : priv)[k] = v; }
  return { student, priv };
}
